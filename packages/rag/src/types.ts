export interface Document {
  id: string
  content: string
  metadata: Record<string, unknown>
}

export interface Chunk {
  id: string
  content: string
  metadata: {
    start: number
    end: number
    index: number
    documentId: string
  }
}

export interface Splitter {
  split(document: Document): Generator<Chunk> | AsyncGenerator<Chunk>
}

export type LengthFunction = (text: string) => number
