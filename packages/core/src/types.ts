import type { ModelMessage } from 'ai'
import { EvaluationDataset } from './dataset'
import type { Metric } from './metric'

/**
 * Represents a single evaluation sample (single turn)
 */
export type SingleTurnSample = {
  /** The user's input/query */
  query: string
  /** The retrieved contexts (For RAG)  */
  retrievedContexts?: string[]
  /** The model's response */
  response: string
  /** The reference answer (Golden answers) */
  reference?: string
  /** additional information */
  metadata?: Record<string, any>
}

export type MultiTurnSample = {
  /** Array of conversation messages */
  messages: ModelMessage[]
  /** Array of reference messages */
  reference?: ModelMessage[]
  /** additional information */
  metadata?: Record<string, any>
}

export type EvaluationSample = SingleTurnSample | MultiTurnSample

export interface MetricScore {
  /** The name of the metric */
  name: string
  /** The score of the metric (usually between 0 and 1) */
  score: number
  /** The reason for the score */
  reason?: string
  /** Additional information */
  metadata?: Record<string, unknown>
}

export interface SampleResult {
  sample: EvaluationSample
  scores: MetricScore[]
  errors?: Array<{
    metric: string
    error: Error
  }>
}

/**
 * Helper type to extract metric names from an array of metrics
 */
type ExtractMetricNames<T extends readonly Metric[]> = T[number]['name']

/**
 * Type-safe averages object that maps each metric name to its average score
 */
export type Averages<T extends readonly Metric[]> = {
  [K in ExtractMetricNames<T>]: number
}

export interface EvaluationResult<T extends readonly Metric[] = Metric[]> {
  dataset: EvaluationDataset
  statistics: {
    averages: Averages<T>
    totalSamples: number
    totalMetrics: number
  }
}
