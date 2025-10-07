import { describe, it, expect, vi } from 'vitest'
import { Metric, LLMMetric, EmbeddingMetric } from './metric'
import { SingleTurnSample, MultiTurnSample, MetricScore } from './types'

class TestSingleTurnMetric extends Metric {
  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    return {
      name: this.name,
      score: 0.8,
      reason: 'Test single turn evaluation',
    }
  }
}

class TestMultiTurnMetric extends Metric {
  async evaluateMultiTurn(sample: MultiTurnSample): Promise<MetricScore> {
    return {
      name: this.name,
      score: 0.9,
      reason: 'Test multi turn evaluation',
    }
  }
}

class TestBothTurnsMetric extends Metric {
  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    return {
      name: this.name,
      score: 0.7,
      reason: 'Single turn',
    }
  }

  async evaluateMultiTurn(sample: MultiTurnSample): Promise<MetricScore> {
    return {
      name: this.name,
      score: 0.85,
      reason: 'Multi turn',
    }
  }
}

describe('Metric', () => {
  describe('constructor', () => {
    it('should create a metric with name and description', () => {
      const metric = new TestSingleTurnMetric({
        name: 'test-metric',
        description: 'A test metric',
      })

      expect(metric.name).toBe('test-metric')
      expect(metric.description).toBe('A test metric')
    })

    it('should create a metric with only name', () => {
      const metric = new TestSingleTurnMetric({
        name: 'test-metric',
      })

      expect(metric.name).toBe('test-metric')
      expect(metric.description).toBeUndefined()
    })
  })

  describe('evaluateSingleTurn', () => {
    it('should throw error if not implemented', async () => {
      const metric = new Metric({ name: 'test' })
      const sample: SingleTurnSample = {
        query: 'test',
        response: 'response',
      }

      await expect(metric.evaluateSingleTurn(sample)).rejects.toThrow(
        'Metric test does not support single-turn evaluation'
      )
    })

    it('should evaluate single-turn sample when implemented', async () => {
      const metric = new TestSingleTurnMetric({ name: 'test' })
      const sample: SingleTurnSample = {
        query: 'test',
        response: 'response',
      }

      const result = await metric.evaluateSingleTurn(sample)

      expect(result.name).toBe('test')
      expect(result.score).toBe(0.8)
      expect(result.reason).toBe('Test single turn evaluation')
    })
  })

  describe('evaluateMultiTurn', () => {
    it('should throw error if not implemented', async () => {
      const metric = new Metric({ name: 'test' })
      const sample: MultiTurnSample = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      }

      await expect(metric.evaluateMultiTurn(sample)).rejects.toThrow(
        'Metric test does not support multi-turn evaluation'
      )
    })

    it('should evaluate multi-turn sample when implemented', async () => {
      const metric = new TestMultiTurnMetric({ name: 'test' })
      const sample: MultiTurnSample = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      }

      const result = await metric.evaluateMultiTurn(sample)

      expect(result.name).toBe('test')
      expect(result.score).toBe(0.9)
      expect(result.reason).toBe('Test multi turn evaluation')
    })
  })

  describe('evaluate', () => {
    it('should evaluate single-turn sample', async () => {
      const metric = new TestSingleTurnMetric({ name: 'test' })
      const sample: SingleTurnSample = {
        query: 'test',
        response: 'response',
      }

      const result = await metric.evaluate(sample)

      expect(result.score).toBe(0.8)
    })

    it('should evaluate multi-turn sample', async () => {
      const metric = new TestMultiTurnMetric({ name: 'test' })
      const sample: MultiTurnSample = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      }

      const result = await metric.evaluate(sample)

      expect(result.score).toBe(0.9)
    })

    it('should throw error for unsupported sample type', async () => {
      const metric = new TestSingleTurnMetric({ name: 'test' })
      const sample: MultiTurnSample = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      }

      await expect(metric.evaluate(sample)).rejects.toThrow(
        'Metric test does not support multi-turn evaluation'
      )
    })

    it('should handle metric that supports both types', async () => {
      const metric = new TestBothTurnsMetric({ name: 'test' })

      const singleTurnSample: SingleTurnSample = {
        query: 'test',
        response: 'response',
      }

      const multiTurnSample: MultiTurnSample = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      }

      const singleResult = await metric.evaluate(singleTurnSample)
      const multiResult = await metric.evaluate(multiTurnSample)

      expect(singleResult.score).toBe(0.7)
      expect(multiResult.score).toBe(0.85)
    })
  })

  describe('supports', () => {
    it('should return true for single-turn samples when implemented', () => {
      const metric = new TestSingleTurnMetric({ name: 'test' })
      const sample: SingleTurnSample = {
        query: 'test',
        response: 'response',
      }

      expect(metric.supports(sample)).toBe(true)
    })

    it('should return false for multi-turn samples when not implemented', () => {
      const metric = new TestSingleTurnMetric({ name: 'test' })
      const sample: MultiTurnSample = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      }

      expect(metric.supports(sample)).toBe(false)
    })

    it('should return true for multi-turn samples when implemented', () => {
      const metric = new TestMultiTurnMetric({ name: 'test' })
      const sample: MultiTurnSample = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      }

      expect(metric.supports(sample)).toBe(true)
    })

    it('should return false for single-turn samples when not implemented', () => {
      const metric = new TestMultiTurnMetric({ name: 'test' })
      const sample: SingleTurnSample = {
        query: 'test',
        response: 'response',
      }

      expect(metric.supports(sample)).toBe(false)
    })

    it('should return true for both types when both are implemented', () => {
      const metric = new TestBothTurnsMetric({ name: 'test' })

      const singleTurnSample: SingleTurnSample = {
        query: 'test',
        response: 'response',
      }

      const multiTurnSample: MultiTurnSample = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      }

      expect(metric.supports(singleTurnSample)).toBe(true)
      expect(metric.supports(multiTurnSample)).toBe(true)
    })
  })

  describe('LLMMetric', () => {
    it('should extend Metric', () => {
      class TestLLMMetric extends LLMMetric {
        async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
          return { name: this.name, score: 0.5 }
        }
      }

      const metric = new TestLLMMetric({ name: 'llm-test' })
      expect(metric).toBeInstanceOf(Metric)
      expect(metric).toBeInstanceOf(LLMMetric)
    })
  })

  describe('EmbeddingMetric', () => {
    it('should extend Metric', () => {
      class TestEmbeddingMetric extends EmbeddingMetric {
        async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
          return { name: this.name, score: 0.5 }
        }
      }

      const metric = new TestEmbeddingMetric({ name: 'embedding-test' })
      expect(metric).toBeInstanceOf(Metric)
      expect(metric).toBeInstanceOf(EmbeddingMetric)
    })
  })
})
