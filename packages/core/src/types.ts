import type { ModelMessage } from 'ai'
import { EvaluationDataset } from './dataset'

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

export interface EvaluationResult {
  dataset: EvaluationDataset
  statistics: {
    averages: Record<string, number>
    totalSamples: number
    totalMetrics: number
  }
}
