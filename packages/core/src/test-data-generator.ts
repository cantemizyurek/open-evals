import { EvaluationDataset } from './dataset'
import type { EvaluationSample } from './types'
import type {
  TestDataSource,
  TestDataGenerationConfig,
  TestDataMetadata,
  GenerationContext,
} from './test-data-source'
import { pLimit } from './utils'

/**
 * Configuration for the test data generator
 */
export interface TestDataGeneratorConfig {
  /** Default concurrency for parallel generation */
  defaultConcurrency?: number
  /** Whether to validate samples by default */
  defaultValidate?: boolean
  /** Global metadata to attach to all samples */
  globalMetadata?: Partial<TestDataMetadata>
}

/**
 * Result from test data generation
 */
export interface GenerationResult {
  /** Generated dataset */
  dataset: EvaluationDataset
  /** Number of samples generated */
  count: number
  /** Generation duration in milliseconds */
  duration: number
  /** Metadata about the generation process */
  metadata: {
    sources: string[]
    errors?: Error[]
  }
}

/**
 * TestDataGenerator - Unified abstraction for generating evaluation datasets
 *
 * This class provides a high-level interface for creating test data from various sources:
 * - Synthetic Data Generation (SDG) pipelines
 * - Manual sample creation
 * - File/database loading
 * - Template-based generation
 * - Transformations of existing datasets
 *
 * @example
 * ```typescript
 * const generator = new TestDataGenerator()
 *   .from(sdgSource)
 *   .from(manualSource)
 *
 * const result = await generator.generate({ count: 100 })
 * const dataset = result.dataset
 * ```
 */
export class TestDataGenerator {
  private sources: TestDataSource[] = []
  private config: TestDataGeneratorConfig

  constructor(config: TestDataGeneratorConfig = {}) {
    this.config = {
      defaultConcurrency: 10,
      defaultValidate: false,
      ...config,
    }
  }

  /**
   * Add a test data source to this generator
   *
   * @param source - Test data source to add
   * @returns This generator (for chaining)
   */
  from(source: TestDataSource): this {
    this.sources.push(source)
    return this
  }

  /**
   * Add multiple test data sources
   *
   * @param sources - Array of test data sources
   * @returns This generator (for chaining)
   */
  fromMany(sources: TestDataSource[]): this {
    this.sources.push(...sources)
    return this
  }

  /**
   * Generate evaluation dataset from all configured sources
   *
   * @param config - Generation configuration
   * @returns Promise resolving to generation result
   */
  async generate(config: Partial<TestDataGenerationConfig> = {}): Promise<GenerationResult> {
    const startTime = Date.now()
    const errors: Error[] = []

    if (this.sources.length === 0) {
      throw new Error('No test data sources configured. Add sources using .from() or .fromMany()')
    }

    const fullConfig: TestDataGenerationConfig = {
      count: config.count ?? 10,
      concurrency: config.concurrency ?? this.config.defaultConcurrency,
      validate: config.validate ?? this.config.defaultValidate,
      metadata: {
        ...this.config.globalMetadata,
        ...config.metadata,
      },
    }

    // Validate all sources
    await this.validateSources(fullConfig)

    // Distribute count across sources
    const samplesPerSource = this.distributeSamples(fullConfig.count)

    // Create source-count pairs
    const sourceTasks = this.sources.map((source, index) => ({
      source,
      count: samplesPerSource[index],
    }))

    // Generate samples from each source in parallel
    const sampleArrays = await pLimit(
      sourceTasks,
      async (task) => {
        try {
          const samples = await task.source.generate({
            ...fullConfig,
            count: task.count,
          })

          // Attach source metadata to samples
          return samples.map((sample) => this.attachMetadata(sample, task.source, fullConfig))
        } catch (error) {
          errors.push(error as Error)
          console.error(`Error generating from source "${task.source.name}":`, error)
          return []
        }
      },
      fullConfig.concurrency!
    )
    const allSamples = sampleArrays.flat()

    // Create dataset
    const dataset = new EvaluationDataset(allSamples)

    const duration = Date.now() - startTime

    return {
      dataset,
      count: allSamples.length,
      duration,
      metadata: {
        sources: this.sources.map((s) => s.name),
        errors: errors.length > 0 ? errors : undefined,
      },
    }
  }

  /**
   * Generate dataset and return only the dataset (convenience method)
   *
   * @param config - Generation configuration
   * @returns Promise resolving to evaluation dataset
   */
  async generateDataset(config: Partial<TestDataGenerationConfig> = {}): Promise<EvaluationDataset> {
    const result = await this.generate(config)
    return result.dataset
  }

  /**
   * Estimate the total cost of generation
   *
   * @param config - Generation configuration
   * @returns Promise resolving to estimated cost
   */
  async estimateCost(config: Partial<TestDataGenerationConfig> = {}): Promise<number> {
    const fullConfig: TestDataGenerationConfig = {
      count: config.count ?? 10,
      concurrency: config.concurrency ?? this.config.defaultConcurrency,
    }

    const samplesPerSource = this.distributeSamples(fullConfig.count)

    const costs = await Promise.all(
      this.sources.map(async (source, index) => {
        if (source.estimateCost) {
          return await source.estimateCost({
            ...fullConfig,
            count: samplesPerSource[index],
          })
        }
        return 0
      })
    )

    return costs.reduce((total, cost) => total + cost, 0)
  }

  /**
   * Get list of configured sources
   */
  getSources(): readonly TestDataSource[] {
    return [...this.sources]
  }

  /**
   * Remove all sources
   */
  clearSources(): this {
    this.sources = []
    return this
  }

  // Private methods

  private async validateSources(config: TestDataGenerationConfig): Promise<void> {
    const validationPromises = this.sources
      .filter((source) => source.validate)
      .map((source) => source.validate!(config))

    await Promise.all(validationPromises)
  }

  private distributeSamples(totalCount: number): number[] {
    const sourceCount = this.sources.length
    const baseCount = Math.floor(totalCount / sourceCount)
    const remainder = totalCount % sourceCount

    return this.sources.map((_, index) => baseCount + (index < remainder ? 1 : 0))
  }

  private attachMetadata(
    sample: EvaluationSample,
    source: TestDataSource,
    config: TestDataGenerationConfig
  ): EvaluationSample {
    const sourceMetadata: Partial<TestDataMetadata> = {
      source: source.name,
      generatedAt: new Date(),
      ...config.metadata,
    }

    return {
      ...sample,
      metadata: {
        ...sample.metadata,
        ...sourceMetadata,
      },
    }
  }
}
