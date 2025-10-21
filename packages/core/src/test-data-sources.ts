import { EvaluationDataset } from './dataset'
import type { EvaluationSample } from './types'
import type {
  TestDataSource,
  TestDataGenerationConfig,
  GenerationContext,
} from './test-data-source'

/**
 * Generator function type for creating samples
 */
export type SampleGenerator = (context: GenerationContext) => EvaluationSample | Promise<EvaluationSample>

/**
 * Configuration for function-based source
 */
export interface FunctionSourceConfig {
  /** Source name */
  name?: string
  /** Source description */
  description?: string
  /** Generator function */
  generator: SampleGenerator
  /** Cost estimation function */
  estimateCost?: (count: number) => number
}

/**
 * Create a test data source from a generator function
 *
 * @example
 * ```typescript
 * const source = createFunctionSource({
 *   name: 'qa-pairs',
 *   generator: async (ctx) => ({
 *     query: `Question ${ctx.index + 1}`,
 *     response: `Answer ${ctx.index + 1}`,
 *     reference: `Reference ${ctx.index + 1}`
 *   })
 * })
 * ```
 */
export function createFunctionSource(config: FunctionSourceConfig): TestDataSource {
  return {
    name: config.name ?? 'function',
    description: config.description ?? 'Function-based test data source',
    async generate(genConfig: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      const samples: EvaluationSample[] = []

      for (let i = 0; i < genConfig.count; i++) {
        const context: GenerationContext = {
          index: i,
          total: genConfig.count,
        }
        const sample = await config.generator(context)
        samples.push(sample)
      }

      return samples
    },
    estimateCost(genConfig: TestDataGenerationConfig) {
      return config.estimateCost ? config.estimateCost(genConfig.count) : genConfig.count
    },
  }
}

/**
 * Configuration for loading from JSON/JSONL files
 */
export interface FileSourceConfig {
  /** File path or content */
  content: string
  /** File format */
  format: 'json' | 'jsonl'
  /** Source name */
  name?: string
}

/**
 * Create a test data source from JSON/JSONL files
 *
 * @example
 * ```typescript
 * const source = createFileSource({
 *   content: jsonContent,
 *   format: 'json'
 * })
 * ```
 */
export function createFileSource(config: FileSourceConfig): TestDataSource {
  let dataset: EvaluationDataset

  return {
    name: config.name ?? `file-${config.format}`,
    description: `File-based test data source (${config.format})`,
    async generate(genConfig: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      // Lazy load dataset
      if (!dataset) {
        dataset =
          config.format === 'json'
            ? EvaluationDataset.fromJSON(config.content)
            : EvaluationDataset.fromJSONL(config.content)
      }

      const samples = dataset.toArray()

      if (genConfig.count >= samples.length) {
        return samples
      }

      // Sample from dataset
      return dataset.sample(genConfig.count).toArray()
    },
    estimateCost() {
      return 0
    },
  }
}

/**
 * Configuration for weighted composite source
 */
export interface WeightedSourceConfig {
  /** Source */
  source: TestDataSource
  /** Weight (relative proportion) */
  weight: number
}

/**
 * Create a composite source that combines sources with weighted distribution
 *
 * @example
 * ```typescript
 * const source = createWeightedSource([
 *   { source: manualSource, weight: 1 },
 *   { source: sdgSource, weight: 3 }
 * ])
 * // Results in 25% manual, 75% SDG
 * ```
 */
export function createWeightedSource(
  configs: WeightedSourceConfig[],
  name = 'weighted-composite'
): TestDataSource {
  const totalWeight = configs.reduce((sum, config) => sum + config.weight, 0)

  return {
    name,
    description: `Weighted composite source with ${configs.length} sources`,
    async generate(genConfig: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      // Calculate samples per source based on weights
      const distributions = configs.map((config) => ({
        source: config.source,
        count: Math.round((config.weight / totalWeight) * genConfig.count),
      }))

      // Adjust for rounding errors
      const totalAssigned = distributions.reduce((sum, d) => sum + d.count, 0)
      if (totalAssigned < genConfig.count) {
        distributions[0].count += genConfig.count - totalAssigned
      }

      // Generate from each source
      const allSamples = await Promise.all(
        distributions.map((dist) =>
          dist.source.generate({
            ...genConfig,
            count: dist.count,
          })
        )
      )

      return allSamples.flat()
    },
    async estimateCost(genConfig: TestDataGenerationConfig) {
      const distributions = configs.map((config) => ({
        source: config.source,
        count: Math.round((config.weight / totalWeight) * genConfig.count),
      }))

      const costs = await Promise.all(
        distributions.map((dist) =>
          dist.source.estimateCost
            ? dist.source.estimateCost({
                ...genConfig,
                count: dist.count,
              })
            : 0
        )
      )

      return costs.reduce((sum, cost) => sum + cost, 0)
    },
  }
}

/**
 * Create a filtering source that validates/filters generated samples
 *
 * @example
 * ```typescript
 * const source = createFilterSource(baseSource, (sample) => {
 *   return sample.query.length > 10
 * })
 * ```
 */
export function createFilterSource(
  baseSource: TestDataSource,
  predicate: (sample: EvaluationSample) => boolean | Promise<boolean>,
  name?: string
): TestDataSource {
  return {
    name: name ?? `filtered-${baseSource.name}`,
    description: `Filtered ${baseSource.description}`,
    async generate(genConfig: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      // Generate extra samples to account for filtering
      const overgenerate = Math.ceil(genConfig.count * 1.5)
      const samples = await baseSource.generate({
        ...genConfig,
        count: overgenerate,
      })

      // Filter samples
      const filtered: EvaluationSample[] = []
      for (const sample of samples) {
        if (await predicate(sample)) {
          filtered.push(sample)
          if (filtered.length >= genConfig.count) {
            break
          }
        }
      }

      return filtered
    },
    async estimateCost(genConfig: TestDataGenerationConfig) {
      const overgenerate = Math.ceil(genConfig.count * 1.5)
      return baseSource.estimateCost
        ? await baseSource.estimateCost({
            ...genConfig,
            count: overgenerate,
          })
        : 0
    },
  }
}

/**
 * Create a caching source that memoizes generated samples
 *
 * @example
 * ```typescript
 * const source = createCachingSource(expensiveSDGSource)
 * ```
 */
export function createCachingSource(baseSource: TestDataSource, name?: string): TestDataSource {
  let cache: EvaluationSample[] | null = null

  return {
    name: name ?? `cached-${baseSource.name}`,
    description: `Cached ${baseSource.description}`,
    async generate(genConfig: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      if (!cache || cache.length < genConfig.count) {
        // Generate or regenerate if cache is insufficient
        cache = await baseSource.generate({
          ...genConfig,
          count: Math.max(genConfig.count, cache?.length ?? 0),
        })
      }

      return cache.slice(0, genConfig.count)
    },
    async estimateCost(genConfig: TestDataGenerationConfig) {
      if (cache && cache.length >= genConfig.count) {
        return 0
      }
      return baseSource.estimateCost ? await baseSource.estimateCost(genConfig) : 0
    },
  }
}

/**
 * Create a batched source that generates in batches for better efficiency
 *
 * @example
 * ```typescript
 * const source = createBatchedSource(sdgSource, 10)
 * ```
 */
export function createBatchedSource(
  baseSource: TestDataSource,
  batchSize: number,
  name?: string
): TestDataSource {
  return {
    name: name ?? `batched-${baseSource.name}`,
    description: `Batched ${baseSource.description} (batch size: ${batchSize})`,
    async generate(genConfig: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      const batches = Math.ceil(genConfig.count / batchSize)
      const allSamples: EvaluationSample[] = []

      for (let i = 0; i < batches; i++) {
        const remainingSamples = genConfig.count - allSamples.length
        const currentBatchSize = Math.min(batchSize, remainingSamples)

        const batchSamples = await baseSource.generate({
          ...genConfig,
          count: currentBatchSize,
        })

        allSamples.push(...batchSamples)
      }

      return allSamples
    },
    estimateCost(genConfig: TestDataGenerationConfig) {
      return baseSource.estimateCost ? baseSource.estimateCost(genConfig) : 0
    },
  }
}
