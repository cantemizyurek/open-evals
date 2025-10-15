import { EvaluationDataset } from './dataset'
import { Metric } from './metric'
import {
  EvaluationResult,
  EvaluationSample,
  MetricScore,
  SampleResult,
} from './types'
import { calculateStatistics, pLimit } from './utils'

export async function evaluate<T extends readonly Metric[]>(
  dataset: EvaluationDataset,
  metrics: T,
  config?: {
    concurrency?: number
    throwOnError?: boolean
    metadata?: Record<string, unknown>
  }
): Promise<EvaluationResult<T>> {
  const { concurrency = 10, throwOnError = false, metadata = {} } = config || {}

  const samples = dataset.toArray()

  if (samples.length === 0) {
    throw new Error('Cannot evaluate empty dataset')
  }

  if (metrics.length === 0) {
    throw new Error('No metrics provided for evaluation')
  }

  const results = await pLimit(
    samples,
    (sample) => evaluateSample(sample, metrics, { throwOnError, metadata }),
    concurrency
  )

  return {
    dataset,
    statistics: calculateStatistics(results),
  }
}

export async function evaluateSample(
  sample: EvaluationSample,
  metrics: readonly Metric[],
  config?: {
    throwOnError?: boolean
    metadata?: Record<string, unknown>
  }
): Promise<SampleResult> {
  const { throwOnError = false, metadata = {} } = config || {}

  const scores: MetricScore[] = []
  const errors: Array<{ metric: string; error: Error }> = []

  const results = await Promise.allSettled(
    metrics.map((metric) => metric.evaluate(sample))
  )

  results.forEach((result, index) => {
    const metric = metrics[index]
    if (result.status === 'fulfilled') {
      scores.push(result.value)
    } else {
      const error =
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason))
      errors.push({ metric: metric.name, error })

      if (throwOnError) throw error
    }
  })

  return {
    sample: { ...sample, metadata },
    scores,
    errors,
  }
}
