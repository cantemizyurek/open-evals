import type { EvaluationDataset } from './dataset'
import type { EvaluationSample } from './types'

/**
 * Metadata for tracking test data provenance and characteristics
 */
export interface TestDataMetadata {
  /** Source of the test data (e.g., 'sdg', 'manual', 'file', 'template') */
  source: string
  /** Generation timestamp */
  generatedAt?: Date
  /** Persona used for generation (if applicable) */
  persona?: string
  /** Scenario type (if applicable) */
  scenarioType?: 'single-hop' | 'multi-hop' | string
  /** Synthesizer type used (if applicable) */
  synthesizerType?: string
  /** Custom metadata */
  custom?: Record<string, unknown>
}

/**
 * Configuration for test data generation
 */
export interface TestDataGenerationConfig {
  /** Number of samples to generate */
  count: number
  /** Concurrency level for parallel generation */
  concurrency?: number
  /** Whether to validate samples after generation */
  validate?: boolean
  /** Metadata to attach to all generated samples */
  metadata?: Partial<TestDataMetadata>
}

/**
 * Context provided to test data sources during generation
 */
export interface GenerationContext {
  /** Current sample index */
  index: number
  /** Total number of samples to generate */
  total: number
  /** Shared context between generations */
  shared?: Record<string, unknown>
}

/**
 * Abstract interface for test data sources
 *
 * A TestDataSource represents a strategy for generating evaluation samples.
 * Implementations can include:
 * - Synthetic Data Generation (SDG) using LLMs
 * - Manual sample creation
 * - Loading from files or databases
 * - Template-based generation
 * - Transformation of existing datasets
 */
export interface TestDataSource {
  /** Unique identifier for this source */
  readonly name: string

  /** Human-readable description */
  readonly description: string

  /**
   * Generate evaluation samples
   *
   * @param config - Generation configuration
   * @returns Promise resolving to generated samples
   */
  generate(config: TestDataGenerationConfig): Promise<EvaluationSample[]>

  /**
   * Validate that this source can generate with the given config
   *
   * @param config - Generation configuration to validate
   * @throws Error if configuration is invalid
   */
  validate?(config: TestDataGenerationConfig): Promise<void> | void

  /**
   * Estimate the cost or resources required for generation
   *
   * @param config - Generation configuration
   * @returns Estimated cost (e.g., API calls, tokens)
   */
  estimateCost?(config: TestDataGenerationConfig): Promise<number> | number
}

/**
 * Composable test data source that combines multiple sources
 */
export interface CompositeTestDataSource extends TestDataSource {
  /** Sources being composed */
  readonly sources: TestDataSource[]

  /**
   * Add another source to the composition
   *
   * @param source - Source to add
   * @returns Updated composite source
   */
  addSource(source: TestDataSource): CompositeTestDataSource
}

/**
 * Test data source that transforms existing datasets
 */
export interface TransformTestDataSource extends TestDataSource {
  /** Source dataset to transform */
  readonly dataset: EvaluationDataset

  /**
   * Transform function applied to each sample
   */
  readonly transform: (sample: EvaluationSample, context: GenerationContext) => Promise<EvaluationSample> | EvaluationSample
}

/**
 * Options for creating a test data source
 */
export interface TestDataSourceOptions {
  /** Source name */
  name: string
  /** Source description */
  description?: string
  /** Validation function */
  validate?: (config: TestDataGenerationConfig) => Promise<void> | void
  /** Cost estimation function */
  estimateCost?: (config: TestDataGenerationConfig) => Promise<number> | number
}
