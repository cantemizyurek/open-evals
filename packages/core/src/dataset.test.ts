import { describe, it, expect, beforeEach } from 'vitest'
import { EvaluationDataset } from './dataset'
import { SingleTurnSample, MultiTurnSample } from './types'

describe('EvaluationDataset', () => {
  let singleTurnSamples: SingleTurnSample[]
  let multiTurnSamples: MultiTurnSample[]

  beforeEach(() => {
    singleTurnSamples = [
      { query: 'What is 2+2?', response: '4', reference: '4' },
      { query: 'What is the capital of France?', response: 'Paris', reference: 'Paris' },
      { query: 'What is 5*5?', response: '25' },
    ]

    multiTurnSamples = [
      {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      },
    ]
  })

  describe('constructor and basic properties', () => {
    it('should create a dataset with samples', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      expect(dataset.length).toBe(3)
    })

    it('should create an empty dataset', () => {
      const dataset = new EvaluationDataset([])
      expect(dataset.length).toBe(0)
    })
  })

  describe('at', () => {
    it('should return the sample at the given index', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      expect(dataset.at(0)).toEqual(singleTurnSamples[0])
      expect(dataset.at(1)).toEqual(singleTurnSamples[1])
    })

    it('should support negative indices', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      expect(dataset.at(-1)).toEqual(singleTurnSamples[2])
      expect(dataset.at(-2)).toEqual(singleTurnSamples[1])
    })

    it('should return undefined for out-of-bounds index', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      expect(dataset.at(10)).toBeUndefined()
    })
  })

  describe('add', () => {
    it('should add a single sample', () => {
      const dataset = new EvaluationDataset([])
      dataset.add(singleTurnSamples[0])
      expect(dataset.length).toBe(1)
      expect(dataset.at(0)).toEqual(singleTurnSamples[0])
    })

    it('should return this for chaining', () => {
      const dataset = new EvaluationDataset([])
      const result = dataset.add(singleTurnSamples[0])
      expect(result).toBe(dataset)
    })
  })

  describe('addMany', () => {
    it('should add multiple samples', () => {
      const dataset = new EvaluationDataset([])
      dataset.addMany(singleTurnSamples)
      expect(dataset.length).toBe(3)
    })

    it('should return this for chaining', () => {
      const dataset = new EvaluationDataset([])
      const result = dataset.addMany(singleTurnSamples)
      expect(result).toBe(dataset)
    })
  })

  describe('map', () => {
    it('should map over samples and return a new dataset', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const mapped = dataset.map((sample) => ({
        ...sample,
        query: (sample as SingleTurnSample).query.toUpperCase(),
      }))

      expect(mapped.length).toBe(3)
      expect((mapped.at(0) as SingleTurnSample).query).toBe('WHAT IS 2+2?')
      expect(mapped).not.toBe(dataset)
    })
  })

  describe('filter', () => {
    it('should filter samples and return a new dataset', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const filtered = dataset.filter(
        (sample) => 'reference' in sample && sample.reference !== undefined
      )

      expect(filtered.length).toBe(2)
      expect(filtered).not.toBe(dataset)
    })
  })

  describe('slice', () => {
    it('should slice the dataset', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const sliced = dataset.slice(1, 3)

      expect(sliced.length).toBe(2)
      expect(sliced.at(0)).toEqual(singleTurnSamples[1])
      expect(sliced.at(1)).toEqual(singleTurnSamples[2])
    })

    it('should slice from start to end when end is not provided', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const sliced = dataset.slice(1)

      expect(sliced.length).toBe(2)
    })
  })

  describe('forEach', () => {
    it('should iterate over all samples', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const queries: string[] = []

      dataset.forEach((sample) => {
        if ('query' in sample) {
          queries.push(sample.query)
        }
      })

      expect(queries).toEqual([
        'What is 2+2?',
        'What is the capital of France?',
        'What is 5*5?',
      ])
    })
  })

  describe('shuffle', () => {
    it('should return a new dataset with shuffled samples', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const shuffled = dataset.shuffle()

      expect(shuffled.length).toBe(dataset.length)
      expect(shuffled).not.toBe(dataset)

      // Check that all original samples are present
      const originalSamples = dataset.toArray()
      const shuffledSamples = shuffled.toArray()
      originalSamples.forEach((sample) => {
        expect(shuffledSamples).toContainEqual(sample)
      })
    })
  })

  describe('split', () => {
    it('should split the dataset by ratio', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const [train, test] = dataset.split(0.67)

      expect(train.length).toBe(2)
      expect(test.length).toBe(1)
      expect(train.length + test.length).toBe(dataset.length)
    })

    it('should handle edge case ratios', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const [train, test] = dataset.split(0)

      expect(train.length).toBe(0)
      expect(test.length).toBe(3)
    })
  })

  describe('sample', () => {
    it('should return a random sample of given size', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const sampled = dataset.sample(2)

      expect(sampled.length).toBe(2)
    })

    it('should handle size larger than dataset', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const sampled = dataset.sample(10)

      expect(sampled.length).toBe(3)
    })
  })

  describe('iterator', () => {
    it('should be iterable with for...of', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const queries: string[] = []

      for (const sample of dataset) {
        if ('query' in sample) {
          queries.push(sample.query)
        }
      }

      expect(queries).toEqual([
        'What is 2+2?',
        'What is the capital of France?',
        'What is 5*5?',
      ])
    })

    it('should work with spread operator', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const samples = [...dataset]

      expect(samples).toEqual(singleTurnSamples)
    })
  })

  describe('toArray', () => {
    it('should return the samples as an array', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const array = dataset.toArray()

      expect(array).toEqual(singleTurnSamples)
    })
  })

  describe('toJSON', () => {
    it('should serialize to JSON string', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const json = dataset.toJSON()

      expect(JSON.parse(json)).toEqual(singleTurnSamples)
    })
  })

  describe('toJSONL', () => {
    it('should serialize to JSONL string', () => {
      const dataset = new EvaluationDataset(singleTurnSamples)
      const jsonl = dataset.toJSONL()

      const lines = jsonl.split('\n')
      expect(lines).toHaveLength(3)
      expect(JSON.parse(lines[0])).toEqual(singleTurnSamples[0])
      expect(JSON.parse(lines[1])).toEqual(singleTurnSamples[1])
      expect(JSON.parse(lines[2])).toEqual(singleTurnSamples[2])
    })
  })

  describe('fromJSON', () => {
    it('should deserialize from JSON string', () => {
      const json = JSON.stringify(singleTurnSamples)
      const dataset = EvaluationDataset.fromJSON(json)

      expect(dataset.length).toBe(3)
      expect(dataset.toArray()).toEqual(singleTurnSamples)
    })
  })

  describe('fromJSONL', () => {
    it('should deserialize from JSONL string', () => {
      const jsonl = JSON.stringify(singleTurnSamples)
      const dataset = EvaluationDataset.fromJSONL(jsonl)

      expect(dataset.length).toBe(3)
      expect(dataset.toArray()).toEqual(singleTurnSamples)
    })
  })
})
