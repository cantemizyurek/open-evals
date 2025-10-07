import { EvaluationSample } from './types'

export class EvaluationDataset {
  private samples: EvaluationSample[] = []

  constructor(samples: EvaluationSample[]) {
    this.samples = samples
  }

  get length() {
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
