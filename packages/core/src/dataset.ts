import { LanguageModel } from 'ai'
import { EvaluationGenerator, EvaluationSample } from './types'
import { pLimit } from './utils'

export class EvaluationDataset {
  private samples: EvaluationSample[] = []

  constructor(samples: EvaluationSample[]) {
    this.samples = samples
  }

  /**
   * Generate responses for the samples using the given generator
   * @param generator - The generator to use for generating responses
   * @param config - Optional configuration for the generation
   * @returns A new EvaluationDataset with the generated responses
   */
  async generate(
    generator: EvaluationGenerator,
    config?: { concurrency?: number }
  ): Promise<EvaluationDataset> {
    const { concurrency = 10 } = config || {}
    return new EvaluationDataset(
      await pLimit(
        this.samples,
        async (sample) => {
          return {
            ...sample,
            response: await generator(sample),
          }
        },
        concurrency
      )
    )
  }

  get length(): number {
    return this.samples.length
  }

  at(index: number): EvaluationSample | undefined {
    return this.samples.at(index)
  }

  add(sample: EvaluationSample): this {
    this.samples.push(sample)
    return this
  }

  addMany(samples: EvaluationSample[]): this {
    this.samples.push(...samples)
    return this
  }

  map(
    callback: (sample: EvaluationSample) => EvaluationSample
  ): EvaluationDataset {
    return new EvaluationDataset(this.samples.map(callback))
  }

  filter(callback: (sample: EvaluationSample) => boolean): EvaluationDataset {
    return new EvaluationDataset(this.samples.filter(callback))
  }

  slice(start: number, end?: number): EvaluationDataset {
    return new EvaluationDataset(this.samples.slice(start, end))
  }

  forEach(callback: (sample: EvaluationSample) => void): void {
    this.samples.forEach(callback)
  }

  shuffle(): EvaluationDataset {
    const shuffled = [...this.samples]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return new EvaluationDataset(shuffled)
  }

  split(ratio: number): [EvaluationDataset, EvaluationDataset] {
    const splitIndex = Math.floor(this.samples.length * ratio)
    return [this.slice(0, splitIndex), this.slice(splitIndex)]
  }

  sample(size: number): EvaluationDataset {
    return this.shuffle().slice(0, size)
  }

  *[Symbol.iterator](): Iterator<EvaluationSample> {
    yield* this.samples
  }

  toArray(): EvaluationSample[] {
    return this.samples
  }

  toJSON(): string {
    return JSON.stringify(this.samples)
  }

  toJSONL(): string {
    return this.samples.map((sample) => JSON.stringify(sample)).join('\n')
  }

  static fromJSON(json: string): EvaluationDataset {
    return new EvaluationDataset(JSON.parse(json))
  }

  static fromJSONL(jsonl: string): EvaluationDataset {
    return new EvaluationDataset(JSON.parse(jsonl))
  }
}
