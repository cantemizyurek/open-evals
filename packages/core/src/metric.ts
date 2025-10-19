import { EmbeddingModel, LanguageModel } from 'ai'
import {
  EvaluationSample,
  MetricScore,
  MultiTurnSample,
  SingleTurnSample,
} from './types'
import { isMultiTurnSample, isSingleTurnSample } from './utils'

export interface MetricConfig<Name extends string = string> {
  /** Unique name for this metric */
  name: Name
  /** Optional description */
  description?: string
}

export abstract class Metric<Name extends string = string> {
  readonly name: Name
  readonly description?: string

  constructor(config: MetricConfig<Name>) {
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

export interface LLMMetricConfig<Name extends string = string>
  extends MetricConfig<Name> {
  model: LanguageModel
}

/**
 * Base class for metrics that use LLMs for evaluation
 */
export abstract class LLMMetric<
  Name extends string = string
> extends Metric<Name> {
  readonly model: LanguageModel

  constructor(config: LLMMetricConfig<Name>) {
    super(config)
    this.model = config.model
  }
}

export interface EmbeddingMetricConfig<Name extends string = string>
  extends MetricConfig<Name> {
  model: EmbeddingModel
}

/**
 * Base class for metrics that use embeddings for evaluation
 */
export abstract class EmbeddingMetric<
  Name extends string = string
> extends Metric<Name> {
  readonly model: EmbeddingModel

  constructor(config: EmbeddingMetricConfig<Name>) {
    super(config)
    this.model = config.model
  }
}
