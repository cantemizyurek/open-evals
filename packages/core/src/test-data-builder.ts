import { EvaluationDataset } from './dataset'
import type { EvaluationSample, SingleTurnSample, MultiTurnSample } from './types'
import {
  TestDataGenerator,
  type TestDataGeneratorConfig,
  type GenerationResult,
} from './test-data-generator'
import type {
  TestDataSource,
  TestDataGenerationConfig,
  TestDataMetadata,
  GenerationContext,
} from './test-data-source'

/**
 * Fluent builder for creating test data sources and generators
 *
 * Provides a convenient API for constructing test data generation pipelines
 * without directly instantiating sources and generators.
 *
 * @example
 * ```typescript
 * const dataset = await TestDataBuilder.create()
 *   .withManualSamples([
 *     { query: 'What is 2+2?', response: '4', reference: '4' }
 *   ])
 *   .withSDG(sdgConfig)
 *   .withMetadata({ source: 'test-suite-v1' })
 *   .build({ count: 100 })
 * ```
 */
export class TestDataBuilder {
  private sources: TestDataSource[] = []
  private generatorConfig: TestDataGeneratorConfig = {}
  private generationConfig: Partial<TestDataGenerationConfig> = {}

  private constructor() {}

  /**
   * Create a new builder instance
   */
  static create(): TestDataBuilder {
    return new TestDataBuilder()
  }

  /**
   * Add a test data source
   *
   * @param source - Test data source to add
   * @returns This builder (for chaining)
   */
  withSource(source: TestDataSource): this {
    this.sources.push(source)
    return this
  }

  /**
   * Add multiple test data sources
   *
   * @param sources - Array of test data sources
   * @returns This builder (for chaining)
   */
  withSources(sources: TestDataSource[]): this {
    this.sources.push(...sources)
    return this
  }

  /**
   * Add manual samples as a source
   *
   * @param samples - Array of evaluation samples
   * @param name - Optional name for this source
   * @returns This builder (for chaining)
   */
  withManualSamples(samples: EvaluationSample[], name = 'manual'): this {
    this.sources.push(createManualSource(samples, name))
    return this
  }

  /**
   * Add a single manual sample
   *
   * @param sample - Evaluation sample
   * @returns This builder (for chaining)
   */
  withSample(sample: EvaluationSample): this {
    this.sources.push(createManualSource([sample], 'manual-single'))
    return this
  }

  /**
   * Add samples from an existing dataset
   *
   * @param dataset - Evaluation dataset
   * @param name - Optional name for this source
   * @returns This builder (for chaining)
   */
  withDataset(dataset: EvaluationDataset, name = 'dataset'): this {
    this.sources.push(createDatasetSource(dataset, name))
    return this
  }

  /**
   * Add a transformation source that modifies existing samples
   *
   * @param dataset - Source dataset to transform
   * @param transform - Transformation function
   * @param name - Optional name for this source
   * @returns This builder (for chaining)
   */
  withTransform(
    dataset: EvaluationDataset,
    transform: (sample: EvaluationSample, context: GenerationContext) => EvaluationSample | Promise<EvaluationSample>,
    name = 'transform'
  ): this {
    this.sources.push(createTransformSource(dataset, transform, name))
    return this
  }

  /**
   * Set global metadata for all generated samples
   *
   * @param metadata - Metadata to attach
   * @returns This builder (for chaining)
   */
  withMetadata(metadata: Partial<TestDataMetadata>): this {
    this.generatorConfig.globalMetadata = {
      ...this.generatorConfig.globalMetadata,
      ...metadata,
    }
    return this
  }

  /**
   * Set default concurrency level
   *
   * @param concurrency - Number of parallel operations
   * @returns This builder (for chaining)
   */
  withConcurrency(concurrency: number): this {
    this.generatorConfig.defaultConcurrency = concurrency
    this.generationConfig.concurrency = concurrency
    return this
  }

  /**
   * Enable validation of generated samples
   *
   * @param validate - Whether to validate
   * @returns This builder (for chaining)
   */
  withValidation(validate = true): this {
    this.generatorConfig.defaultValidate = validate
    this.generationConfig.validate = validate
    return this
  }

  /**
   * Set the number of samples to generate
   *
   * @param count - Number of samples
   * @returns This builder (for chaining)
   */
  withCount(count: number): this {
    this.generationConfig.count = count
    return this
  }

  /**
   * Build and generate the dataset
   *
   * @param config - Optional generation configuration override
   * @returns Promise resolving to generation result
   */
  async build(config: Partial<TestDataGenerationConfig> = {}): Promise<GenerationResult> {
    const generator = new TestDataGenerator(this.generatorConfig)
    generator.fromMany(this.sources)

    const finalConfig = {
      ...this.generationConfig,
      ...config,
    }

    return await generator.generate(finalConfig)
  }

  /**
   * Build and return only the dataset (convenience method)
   *
   * @param config - Optional generation configuration override
   * @returns Promise resolving to evaluation dataset
   */
  async buildDataset(config: Partial<TestDataGenerationConfig> = {}): Promise<EvaluationDataset> {
    const result = await this.build(config)
    return result.dataset
  }

  /**
   * Get the configured generator without executing
   *
   * @returns Configured test data generator
   */
  getGenerator(): TestDataGenerator {
    const generator = new TestDataGenerator(this.generatorConfig)
    generator.fromMany(this.sources)
    return generator
  }
}

// Helper functions for creating common sources

/**
 * Create a manual test data source from samples
 *
 * @param samples - Array of evaluation samples
 * @param name - Source name
 * @returns Test data source
 */
export function createManualSource(samples: EvaluationSample[], name = 'manual'): TestDataSource {
  return {
    name,
    description: `Manual test data source with ${samples.length} samples`,
    async generate(config: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      // Return requested count, cycling through samples if needed
      const result: EvaluationSample[] = []
      for (let i = 0; i < config.count; i++) {
        result.push(samples[i % samples.length])
      }
      return result
    },
    estimateCost() {
      return 0 // Manual samples have no cost
    },
  }
}

/**
 * Create a test data source from an existing dataset
 *
 * @param dataset - Evaluation dataset
 * @param name - Source name
 * @returns Test data source
 */
export function createDatasetSource(dataset: EvaluationDataset, name = 'dataset'): TestDataSource {
  const samples = dataset.toArray()
  return {
    name,
    description: `Dataset source with ${samples.length} samples`,
    async generate(config: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      // Sample from dataset
      if (config.count >= samples.length) {
        return samples
      }
      return dataset.sample(config.count).toArray()
    },
    estimateCost() {
      return 0
    },
  }
}

/**
 * Create a transformation source
 *
 * @param dataset - Source dataset
 * @param transform - Transformation function
 * @param name - Source name
 * @returns Test data source
 */
export function createTransformSource(
  dataset: EvaluationDataset,
  transform: (sample: EvaluationSample, context: GenerationContext) => EvaluationSample | Promise<EvaluationSample>,
  name = 'transform'
): TestDataSource {
  const samples = dataset.toArray()
  return {
    name,
    description: `Transform source with ${samples.length} base samples`,
    async generate(config: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      const count = Math.min(config.count, samples.length)
      const result: EvaluationSample[] = []

      for (let i = 0; i < count; i++) {
        const context: GenerationContext = {
          index: i,
          total: count,
        }
        const transformed = await transform(samples[i], context)
        result.push(transformed)
      }

      return result
    },
    estimateCost() {
      return 0
    },
  }
}

/**
 * Create a template-based source that generates samples from a template function
 *
 * @param template - Function that generates a sample given an index
 * @param name - Source name
 * @returns Test data source
 */
export function createTemplateSource(
  template: (context: GenerationContext) => EvaluationSample | Promise<EvaluationSample>,
  name = 'template'
): TestDataSource {
  return {
    name,
    description: 'Template-based test data source',
    async generate(config: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      const result: EvaluationSample[] = []

      for (let i = 0; i < config.count; i++) {
        const context: GenerationContext = {
          index: i,
          total: config.count,
        }
        const sample = await template(context)
        result.push(sample)
      }

      return result
    },
    estimateCost(config: TestDataGenerationConfig) {
      return config.count
    },
  }
}

/**
 * Create a composite source that combines multiple sources
 *
 * @param sources - Array of sources to combine
 * @param name - Source name
 * @returns Test data source
 */
export function createCompositeSource(sources: TestDataSource[], name = 'composite'): TestDataSource {
  return {
    name,
    description: `Composite source combining ${sources.length} sources`,
    async generate(config: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      const samplesPerSource = Math.ceil(config.count / sources.length)
      const allSamples = await Promise.all(
        sources.map((source) =>
          source.generate({
            ...config,
            count: samplesPerSource,
          })
        )
      )

      return allSamples.flat().slice(0, config.count)
    },
    async estimateCost(config: TestDataGenerationConfig) {
      const samplesPerSource = Math.ceil(config.count / sources.length)
      const costs = await Promise.all(
        sources.map((source) =>
          source.estimateCost
            ? source.estimateCost({
                ...config,
                count: samplesPerSource,
              })
            : 0
        )
      )
      return costs.reduce((sum, cost) => sum + cost, 0)
    },
  }
}
