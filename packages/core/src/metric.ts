import {
  EvaluationSample,
  MetricScore,
  MultiTurnSample,
  SingleTurnSample,
} from './types'
import { isMultiTurnSample, isSingleTurnSample } from './utils'

export interface MetricConfig {
  /** Unique name for this metric */
  name: string
  /** Optional description */
  description?: string
}

export abstract class Metric {
  readonly name: string
  readonly description?: string

  constructor(config: MetricConfig) {
    this.name = config.name
    this.description = config.description
  }

  /**
   * Evaluate a single-turn sample
   * Override this method for single-turn metrics
   */
  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    throw new Error(
      `Metric ${this.name} does not support single-turn evaluation`
    )
  }

  /**
   * Evaluate a multi-turn sample
   * Override this method for multi-turn metrics
   */
  async evaluateMultiTurn(sample: MultiTurnSample): Promise<MetricScore> {
    throw new Error(
      `Metric ${this.name} does not support multi-turn evaluation`
    )
  }

  async evaluate(sample: EvaluationSample): Promise<MetricScore> {
    if (isSingleTurnSample(sample)) {
      return this.evaluateSingleTurn(sample)
    } else if (isMultiTurnSample(sample)) {
      return this.evaluateMultiTurn(sample)
    }
    throw new Error(`Metric ${this.name} does not support this sample type`)
  }

  supports(sample: EvaluationSample): boolean {
    try {
      if (isSingleTurnSample(sample)) {
        return this.evaluateSingleTurn !== Metric.prototype.evaluateSingleTurn
      } else if (isMultiTurnSample(sample)) {
        return this.evaluateMultiTurn !== Metric.prototype.evaluateMultiTurn
      }
      return false
    } catch {
      return false
    }
  }
}

/**
 * Base class for metrics that use LLMs for evaluation
 */
export abstract class LLMMetric extends Metric {}

/**
 * Base class for metrics that use embeddings for evaluation
 */
export abstract class EmbeddingMetric extends Metric {}
