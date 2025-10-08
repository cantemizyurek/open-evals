import {
  EvaluationResult,
  EvaluationSample,
  MetricScore,
  MultiTurnSample,
  SampleResult,
  SingleTurnSample,
} from './types'

export function isSingleTurnSample(
  sample: EvaluationSample
): sample is SingleTurnSample {
  return 'query' in sample && 'response' in sample
}

export function isMultiTurnSample(
  sample: EvaluationSample
): sample is MultiTurnSample {
  return 'messages' in sample
}

export async function pLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: Promise<R>[] = []
  let executing: T[] = []

  for (const item of items) {
    const promise = fn(item).then((result) => {
      executing = executing.filter((i) => i !== item)
      return result
    })

    results.push(promise)
    executing.push(item)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
    }
  }

  return Promise.all(results)
}

export function calculateStatistics(
  results: SampleResult[]
): EvaluationResult['statistics'] {
  const metricScores = new Map<string, number[]>()
  results.forEach((result) => {
    result.scores.forEach((score) => {
      if (!metricScores.has(score.name)) {
        metricScores.set(score.name, [])
      }
      metricScores.get(score.name)!.push(score.score)
    })
  })

  const averages: Record<string, number> = {}
  metricScores.forEach((scores, name) => {
    const sum = scores.reduce((acc, score) => acc + score, 0)
    averages[name] = sum / scores.length
  })

  return {
    averages,
    totalSamples: results.length,
    totalMetrics: metricScores.size,
  }
}

/**
 * Shuffle an array using the Fisher-Yates algorithm
 * Returns a new shuffled array without modifying the original
 *
 * @param array - The array to shuffle
 * @returns A new shuffled array
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array]

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}
