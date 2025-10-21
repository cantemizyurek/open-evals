import { ModelMessage } from 'ai'

export type { ModelMessage }

export type {
  SingleTurnSample,
  MultiTurnSample,
  EvaluationSample,
  MetricScore,
  SampleResult,
  EvaluationResult,
} from './types'

export { EvaluationDataset } from './dataset'

export { Metric, LLMMetric, EmbeddingMetric } from './metric'
export type { MetricConfig } from './metric'

export { evaluate } from './evaluate'

export { pLimit, shuffle, isSingleTurnSample, isMultiTurnSample } from './utils'

// Test Data Generation Abstraction
export type {
  TestDataSource,
  TestDataMetadata,
  TestDataGenerationConfig,
  GenerationContext,
  CompositeTestDataSource,
  TransformTestDataSource,
  TestDataSourceOptions,
} from './test-data-source'

export {
  TestDataGenerator,
  type TestDataGeneratorConfig,
  type GenerationResult,
} from './test-data-generator'

export {
  TestDataBuilder,
  createManualSource,
  createDatasetSource,
  createTransformSource,
  createTemplateSource,
  createCompositeSource,
} from './test-data-builder'

export {
  createFunctionSource,
  createFileSource,
  createWeightedSource,
  createFilterSource,
  createCachingSource,
  createBatchedSource,
  type FunctionSourceConfig,
  type FileSourceConfig,
  type WeightedSourceConfig,
  type SampleGenerator,
} from './test-data-sources'
