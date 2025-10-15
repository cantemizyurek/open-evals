import { describe, it, expect, vi, beforeEach } from 'vitest'
import { evaluate, evaluateSample } from './evaluate'
import { EvaluationDataset } from './dataset'
import { Metric } from './metric'
import { SingleTurnSample, MetricScore } from './types'

class MockMetric extends Metric {
  constructor(name: string, private scoreValue: number = 0.8) {
    super({ name })
  }

  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    return {
      name: this.name,
      score: this.scoreValue,
      reason: `Evaluated ${sample.query}`,
    }
  }
}

class MockFailingMetric extends Metric {
  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    throw new Error('Metric evaluation failed')
  }
}

describe('evaluate', () => {
  let dataset: EvaluationDataset
  let metrics: Metric[]

  beforeEach(() => {
    const samples: SingleTurnSample[] = [
      { query: 'Question 1', response: 'Answer 1' },
      { query: 'Question 2', response: 'Answer 2' },
      { query: 'Question 3', response: 'Answer 3' },
    ]
    dataset = new EvaluationDataset(samples)
    metrics = [
      new MockMetric('accuracy', 0.8),
      new MockMetric('relevance', 0.9),
    ]
  })

  describe('basic evaluation', () => {
    it('should evaluate a dataset with metrics', async () => {
      const result = await evaluate(dataset, metrics)

      expect(result.dataset).toBe(dataset)
      expect(result.statistics.totalSamples).toBe(3)
      expect(result.statistics.totalMetrics).toBe(2)
      expect(result.statistics.averages.accuracy).toBeCloseTo(0.8)
      expect(result.statistics.averages.relevance).toBeCloseTo(0.9)
    })

    it('should provide type-safe averages derived from metrics', async () => {
      class AccuracyMetric extends Metric<'accuracy'> {
        constructor() {
          super({ name: 'accuracy' })
        }
        async evaluateSingleTurn(
          sample: SingleTurnSample
        ): Promise<MetricScore> {
          return { name: this.name, score: 0.8 }
        }
      }

      class RelevanceMetric extends Metric<'relevance'> {
        constructor() {
          super({ name: 'relevance' })
        }
        async evaluateSingleTurn(
          sample: SingleTurnSample
        ): Promise<MetricScore> {
          return { name: this.name, score: 0.9 }
        }
      }

      const typeSafeMetrics = [new AccuracyMetric(), new RelevanceMetric()]

      const result = await evaluate(dataset, typeSafeMetrics)

      expect(result.statistics.averages.accuracy).toBeCloseTo(0.8)
      expect(result.statistics.averages.relevance).toBeCloseTo(0.9)
    })

    it('should throw error for empty dataset', async () => {
      const emptyDataset = new EvaluationDataset([])

      await expect(evaluate(emptyDataset, metrics)).rejects.toThrow(
        'Cannot evaluate empty dataset'
      )
    })

    it('should throw error when no metrics provided', async () => {
      await expect(evaluate(dataset, [])).rejects.toThrow(
        'No metrics provided for evaluation'
      )
    })
  })

  describe('configuration options', () => {
    it('should use default concurrency of 10', async () => {
      const result = await evaluate(dataset, metrics)

      expect(result.statistics.totalSamples).toBe(3)
    })

    it('should respect custom concurrency', async () => {
      const result = await evaluate(dataset, metrics, { concurrency: 1 })

      expect(result.statistics.totalSamples).toBe(3)
    })

    it('should handle metadata in config', async () => {
      const metadata = { experiment: 'test-1' }
      const result = await evaluate(dataset, metrics, { metadata })

      expect(result.statistics.totalSamples).toBe(3)
    })

    it('should not throw on error by default', async () => {
      const failingMetric = new MockFailingMetric({ name: 'failing' })
      const metricsWithFailing = [...metrics, failingMetric]

      const result = await evaluate(dataset, metricsWithFailing)

      expect(result.statistics.totalSamples).toBe(3)
      // Should still have results from successful metrics
      expect(result.statistics.averages.accuracy).toBeCloseTo(0.8)
    })

    it('should throw on error when throwOnError is true', async () => {
      const failingMetric = new MockFailingMetric({ name: 'failing' })
      const metricsWithFailing = [...metrics, failingMetric]

      await expect(
        evaluate(dataset, metricsWithFailing, { throwOnError: true })
      ).rejects.toThrow('Metric evaluation failed')
    })
  })
})

describe('evaluateSample', () => {
  let sample: SingleTurnSample
  let metrics: Metric[]

  beforeEach(() => {
    sample = { query: 'Test question', response: 'Test answer' }
    metrics = [
      new MockMetric('accuracy', 0.8),
      new MockMetric('relevance', 0.9),
    ]
  })

  describe('basic sample evaluation', () => {
    it('should evaluate a sample with metrics', async () => {
      const result = await evaluateSample(sample, metrics)

      expect(result.sample).toMatchObject(sample)
      expect(result.sample.metadata).toEqual({})
      expect(result.scores).toHaveLength(2)
      expect(result.scores[0].name).toBe('accuracy')
      expect(result.scores[0].score).toBe(0.8)
      expect(result.scores[1].name).toBe('relevance')
      expect(result.scores[1].score).toBe(0.9)
      expect(result.errors).toEqual([])
    })

    it('should include metadata in sample when provided', async () => {
      const metadata = { source: 'test' }
      const result = await evaluateSample(sample, metrics, { metadata })

      expect(result.sample.metadata).toEqual(metadata)
    })
  })

  describe('error handling', () => {
    it('should collect errors from failing metrics', async () => {
      const failingMetric = new MockFailingMetric({ name: 'failing' })
      const metricsWithFailing = [...metrics, failingMetric]

      const result = await evaluateSample(sample, metricsWithFailing)

      expect(result.scores).toHaveLength(2)
      expect(result.errors).toHaveLength(1)
      expect(result.errors![0].metric).toBe('failing')
      expect(result.errors![0].error).toBeInstanceOf(Error)
      expect(result.errors![0].error.message).toBe('Metric evaluation failed')
    })

    it('should not throw on error by default', async () => {
      const failingMetric = new MockFailingMetric({ name: 'failing' })
      const metricsWithFailing = [failingMetric]

      const result = await evaluateSample(sample, metricsWithFailing)

      expect(result.scores).toHaveLength(0)
      expect(result.errors).toHaveLength(1)
    })

    it('should throw on error when throwOnError is true', async () => {
      const failingMetric = new MockFailingMetric({ name: 'failing' })
      const metricsWithFailing = [failingMetric]

      await expect(
        evaluateSample(sample, metricsWithFailing, { throwOnError: true })
      ).rejects.toThrow('Metric evaluation failed')
    })

    it('should convert non-Error reasons to Error', async () => {
      class WeirdMetric extends Metric {
        async evaluateSingleTurn(
          sample: SingleTurnSample
        ): Promise<MetricScore> {
          throw 'String error'
        }
      }

      const weirdMetric = new WeirdMetric({ name: 'weird' })
      const result = await evaluateSample(sample, [weirdMetric])

      expect(result.errors).toHaveLength(1)
      expect(result.errors![0].error).toBeInstanceOf(Error)
      expect(result.errors![0].error.message).toBe('String error')
    })
  })

  describe('multiple metrics', () => {
    it('should evaluate all metrics in parallel', async () => {
      const startTimes: number[] = []
      const endTimes: number[] = []

      class TimedMetric extends Metric {
        constructor(name: string) {
          super({ name })
        }

        async evaluateSingleTurn(
          sample: SingleTurnSample
        ): Promise<MetricScore> {
          startTimes.push(Date.now())
          await new Promise((resolve) => setTimeout(resolve, 10))
          endTimes.push(Date.now())
          return { name: this.name, score: 1.0 }
        }
      }

      const timedMetrics = [
        new TimedMetric('metric1'),
        new TimedMetric('metric2'),
        new TimedMetric('metric3'),
      ]

      await evaluateSample(sample, timedMetrics)

      // All metrics should start around the same time (parallel execution)
      const startTimeRange = Math.max(...startTimes) - Math.min(...startTimes)
      expect(startTimeRange).toBeLessThan(50) // Allow some variance for timing
    })

    it('should handle mix of successful and failing metrics', async () => {
      const mixedMetrics = [
        new MockMetric('success1', 0.8),
        new MockFailingMetric({ name: 'failure' }),
        new MockMetric('success2', 0.6),
      ]

      const result = await evaluateSample(sample, mixedMetrics)

      expect(result.scores).toHaveLength(2)
      expect(result.errors).toHaveLength(1)
      expect(result.scores.map((s) => s.name)).toEqual(['success1', 'success2'])
    })
  })

  describe('sample with metadata', () => {
    it('should preserve existing sample metadata and merge with config metadata', async () => {
      const sampleWithMetadata: SingleTurnSample = {
        ...sample,
        metadata: { existing: 'data' },
      }
      const configMetadata = { new: 'metadata' }

      const result = await evaluateSample(sample, metrics, {
        metadata: configMetadata,
      })

      expect(result.sample.metadata).toEqual(configMetadata)
    })
  })
})
