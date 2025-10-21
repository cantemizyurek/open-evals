import { describe, it, expect } from 'vitest'
import { TestDataGenerator } from './test-data-generator'
import { TestDataBuilder } from './test-data-builder'
import { createFunctionSource, createWeightedSource } from './test-data-sources'
import type { EvaluationSample, SingleTurnSample } from './types'
import type { TestDataSource, GenerationContext } from './test-data-source'

describe('TestDataGenerator', () => {
  // Helper to create a simple test source
  const createSimpleSource = (name: string, prefix: string): TestDataSource => ({
    name,
    description: `Simple source: ${name}`,
    async generate(config) {
      const samples: EvaluationSample[] = []
      for (let i = 0; i < config.count; i++) {
        samples.push({
          query: `${prefix} query ${i}`,
          response: `${prefix} response ${i}`,
          reference: `${prefix} reference ${i}`,
        } as SingleTurnSample)
      }
      return samples
    },
    estimateCost(config) {
      return config.count * 10
    },
  })

  describe('Basic Generation', () => {
    it('should generate dataset from single source', async () => {
      const source = createSimpleSource('test', 'Test')
      const generator = new TestDataGenerator().from(source)

      const result = await generator.generate({ count: 5 })

      expect(result.dataset.toArray()).toHaveLength(5)
      expect(result.count).toBe(5)
      expect(result.metadata.sources).toEqual(['test'])
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should generate dataset from multiple sources', async () => {
      const source1 = createSimpleSource('source1', 'S1')
      const source2 = createSimpleSource('source2', 'S2')

      const generator = new TestDataGenerator().from(source1).from(source2)

      const result = await generator.generate({ count: 10 })

      expect(result.dataset.toArray()).toHaveLength(10)
      expect(result.metadata.sources).toEqual(['source1', 'source2'])
    })

    it('should throw error if no sources configured', async () => {
      const generator = new TestDataGenerator()

      await expect(generator.generate({ count: 5 })).rejects.toThrow(
        'No test data sources configured'
      )
    })
  })

  describe('Sample Distribution', () => {
    it('should distribute samples evenly across sources', async () => {
      const source1 = createSimpleSource('source1', 'S1')
      const source2 = createSimpleSource('source2', 'S2')

      const generator = new TestDataGenerator().from(source1).from(source2)

      const result = await generator.generate({ count: 10 })
      const samples = result.dataset.toArray()

      // Each source should get 5 samples
      const s1Samples = samples.filter((s) => (s as SingleTurnSample).query.startsWith('S1'))
      const s2Samples = samples.filter((s) => (s as SingleTurnSample).query.startsWith('S2'))

      expect(s1Samples).toHaveLength(5)
      expect(s2Samples).toHaveLength(5)
    })

    it('should handle uneven distribution', async () => {
      const source1 = createSimpleSource('source1', 'S1')
      const source2 = createSimpleSource('source2', 'S2')

      const generator = new TestDataGenerator().from(source1).from(source2)

      const result = await generator.generate({ count: 11 })
      const samples = result.dataset.toArray()

      expect(samples).toHaveLength(11)
      // First source gets the extra sample
      const s1Samples = samples.filter((s) => (s as SingleTurnSample).query.startsWith('S1'))
      expect(s1Samples).toHaveLength(6)
    })
  })

  describe('Metadata Handling', () => {
    it('should attach source metadata to samples', async () => {
      const source = createSimpleSource('test-source', 'Test')
      const generator = new TestDataGenerator().from(source)

      const result = await generator.generate({ count: 5 })
      const samples = result.dataset.toArray()

      samples.forEach((sample) => {
        expect(sample.metadata).toBeDefined()
        expect(sample.metadata?.source).toBe('test-source')
        expect(sample.metadata?.generatedAt).toBeInstanceOf(Date)
      })
    })

    it('should merge global metadata', async () => {
      const source = createSimpleSource('test', 'Test')
      const generator = new TestDataGenerator({
        globalMetadata: { custom: { version: '1.0' } },
      })
      generator.from(source)

      const result = await generator.generate({ count: 5 })
      const samples = result.dataset.toArray()

      samples.forEach((sample) => {
        expect(sample.metadata?.custom).toEqual({ version: '1.0' })
      })
    })

    it('should merge generation config metadata', async () => {
      const source = createSimpleSource('test', 'Test')
      const generator = new TestDataGenerator().from(source)

      const result = await generator.generate({
        count: 5,
        metadata: { scenarioType: 'single-hop' },
      })
      const samples = result.dataset.toArray()

      samples.forEach((sample) => {
        expect(sample.metadata?.scenarioType).toBe('single-hop')
      })
    })
  })

  describe('Cost Estimation', () => {
    it('should estimate cost from single source', async () => {
      const source = createSimpleSource('test', 'Test')
      const generator = new TestDataGenerator().from(source)

      const cost = await generator.estimateCost({ count: 10 })

      expect(cost).toBe(100) // 10 samples * 10 cost each
    })

    it('should sum costs from multiple sources', async () => {
      const source1 = createSimpleSource('source1', 'S1')
      const source2 = createSimpleSource('source2', 'S2')

      const generator = new TestDataGenerator().from(source1).from(source2)

      const cost = await generator.estimateCost({ count: 10 })

      expect(cost).toBe(100) // 5 samples * 10 cost * 2 sources
    })
  })

  describe('Source Validation', () => {
    it('should validate sources before generation', async () => {
      const source: TestDataSource = {
        name: 'validating-source',
        description: 'Source with validation',
        async generate() {
          return []
        },
        validate(config) {
          if (config.count > 100) {
            throw new Error('Count too large')
          }
        },
      }

      const generator = new TestDataGenerator().from(source)

      await expect(generator.generate({ count: 200 })).rejects.toThrow('Count too large')
    })
  })

  describe('Error Handling', () => {
    it('should handle source generation errors gracefully', async () => {
      const errorSource: TestDataSource = {
        name: 'error-source',
        description: 'Source that fails',
        async generate() {
          throw new Error('Generation failed')
        },
      }

      const successSource = createSimpleSource('success', 'Success')

      const generator = new TestDataGenerator().from(errorSource).from(successSource)

      const result = await generator.generate({ count: 10 })

      // Should still get samples from the successful source
      expect(result.dataset.toArray().length).toBeGreaterThan(0)
      expect(result.metadata.errors).toBeDefined()
      expect(result.metadata.errors).toHaveLength(1)
    })
  })

  describe('Source Management', () => {
    it('should get list of sources', () => {
      const source1 = createSimpleSource('source1', 'S1')
      const source2 = createSimpleSource('source2', 'S2')

      const generator = new TestDataGenerator().from(source1).from(source2)

      const sources = generator.getSources()
      expect(sources).toHaveLength(2)
      expect(sources[0].name).toBe('source1')
      expect(sources[1].name).toBe('source2')
    })

    it('should clear sources', () => {
      const source = createSimpleSource('test', 'Test')
      const generator = new TestDataGenerator().from(source)

      expect(generator.getSources()).toHaveLength(1)

      generator.clearSources()

      expect(generator.getSources()).toHaveLength(0)
    })

    it('should add multiple sources at once', () => {
      const sources = [
        createSimpleSource('source1', 'S1'),
        createSimpleSource('source2', 'S2'),
      ]

      const generator = new TestDataGenerator().fromMany(sources)

      expect(generator.getSources()).toHaveLength(2)
    })
  })

  describe('Convenience Methods', () => {
    it('should generate dataset directly', async () => {
      const source = createSimpleSource('test', 'Test')
      const generator = new TestDataGenerator().from(source)

      const dataset = await generator.generateDataset({ count: 5 })

      expect(dataset.toArray()).toHaveLength(5)
    })
  })
})

describe('TestDataBuilder', () => {
  describe('Fluent API', () => {
    it('should build dataset from manual samples', async () => {
      const result = await TestDataBuilder.create()
        .withManualSamples([
          { query: 'What is 2+2?', response: '4', reference: '4' } as SingleTurnSample,
        ])
        .build({ count: 3 })

      expect(result.dataset.toArray()).toHaveLength(3)
    })

    it('should build with multiple sources', async () => {
      const result = await TestDataBuilder.create()
        .withManualSamples([{ query: 'Q1', response: 'R1' } as SingleTurnSample])
        .withSample({ query: 'Q2', response: 'R2' } as SingleTurnSample)
        .build({ count: 4 })

      expect(result.dataset.toArray()).toHaveLength(4)
    })

    it('should set metadata', async () => {
      const result = await TestDataBuilder.create()
        .withManualSamples([{ query: 'Q1', response: 'R1' } as SingleTurnSample])
        .withMetadata({ custom: { version: '2.0' } })
        .build({ count: 2 })

      const samples = result.dataset.toArray()
      samples.forEach((sample) => {
        expect(sample.metadata?.custom).toEqual({ version: '2.0' })
      })
    })

    it('should set concurrency', async () => {
      const result = await TestDataBuilder.create()
        .withManualSamples([{ query: 'Q1', response: 'R1' } as SingleTurnSample])
        .withConcurrency(5)
        .build({ count: 2 })

      expect(result.dataset.toArray()).toHaveLength(2)
    })

    it('should build dataset directly', async () => {
      const dataset = await TestDataBuilder.create()
        .withManualSamples([{ query: 'Q1', response: 'R1' } as SingleTurnSample])
        .buildDataset({ count: 3 })

      expect(dataset.toArray()).toHaveLength(3)
    })

    it('should get generator without executing', () => {
      const generator = TestDataBuilder.create()
        .withManualSamples([{ query: 'Q1', response: 'R1' } as SingleTurnSample])
        .getGenerator()

      expect(generator).toBeInstanceOf(TestDataGenerator)
      expect(generator.getSources()).toHaveLength(1)
    })
  })
})

describe('Helper Sources', () => {
  describe('createFunctionSource', () => {
    it('should generate samples from function', async () => {
      const source = createFunctionSource({
        name: 'function-test',
        generator: (ctx: GenerationContext) => ({
          query: `Query ${ctx.index}`,
          response: `Response ${ctx.index}`,
        } as SingleTurnSample),
      })

      const samples = await source.generate({ count: 5, concurrency: 1 })

      expect(samples).toHaveLength(5)
      expect((samples[0] as SingleTurnSample).query).toBe('Query 0')
      expect((samples[4] as SingleTurnSample).query).toBe('Query 4')
    })

    it('should support async generators', async () => {
      const source = createFunctionSource({
        generator: async (ctx) => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return {
            query: `Async ${ctx.index}`,
            response: `Response ${ctx.index}`,
          } as SingleTurnSample
        },
      })

      const samples = await source.generate({ count: 3, concurrency: 1 })

      expect(samples).toHaveLength(3)
    })
  })

  describe('createWeightedSource', () => {
    it('should distribute samples by weight', async () => {
      const source1 = createFunctionSource({
        name: 'source1',
        generator: () => ({ query: 'S1', response: 'R1' } as SingleTurnSample),
      })

      const source2 = createFunctionSource({
        name: 'source2',
        generator: () => ({ query: 'S2', response: 'R2' } as SingleTurnSample),
      })

      const weighted = createWeightedSource([
        { source: source1, weight: 1 },
        { source: source2, weight: 3 },
      ])

      const samples = await weighted.generate({ count: 100, concurrency: 1 })

      const s1Count = samples.filter((s) => (s as SingleTurnSample).query === 'S1').length
      const s2Count = samples.filter((s) => (s as SingleTurnSample).query === 'S2').length

      // Should be approximately 25/75 split
      expect(s1Count).toBeGreaterThanOrEqual(20)
      expect(s1Count).toBeLessThanOrEqual(30)
      expect(s2Count).toBeGreaterThanOrEqual(70)
      expect(s2Count).toBeLessThanOrEqual(80)
    })
  })
})
