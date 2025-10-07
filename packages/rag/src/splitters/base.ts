import type { Splitter, Document, Chunk, LengthFunction } from '../types'

export abstract class BaseSplitter implements Splitter {
  readonly lengthFunction: LengthFunction

  constructor(options?: { lengthFunction?: LengthFunction }) {
    this.lengthFunction =
      options?.lengthFunction || ((text: string) => text.length)
  }

  abstract split(document: Document): AsyncGenerator<Chunk>
}
