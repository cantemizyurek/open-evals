import { BaseSplitter } from './base'
import type { Document, Chunk, LengthFunction } from '../types'

export interface RecursiveCharacterSplitterOptions {
  chunkSize?: number
  chunkOverlap?: number
  separators?: string[]
  keepSeparator?: boolean
  lengthFunction?: LengthFunction
}

interface SeparatorResult {
  separator: string
  remainingSeparators: string[]
}

interface ChunkPosition {
  text: string
  start: number
}

export class RecursiveCharacterSplitter extends BaseSplitter {
  private readonly chunkSize: number
  private readonly chunkOverlap: number
  private readonly separators: string[]
  private readonly keepSeparator: boolean

  constructor(options: RecursiveCharacterSplitterOptions = {}) {
    super({ lengthFunction: options.lengthFunction })
    this.chunkSize = options.chunkSize ?? 1000
    this.chunkOverlap = options.chunkOverlap ?? 200
    this.separators = options.separators ?? ['\n\n', '\n', ' ', '']
    this.keepSeparator = options.keepSeparator ?? true
    this.validateOptions()
  }

  async *split(document: Document): AsyncGenerator<Chunk> {
    const chunksWithPositions = this.splitText(document.content)

    for (let i = 0; i < chunksWithPositions.length; i++) {
      const chunk = chunksWithPositions[i]
      yield this.createChunk(document, chunk, i)
    }
  }

  private validateOptions(): void {
    if (this.chunkSize <= 0) {
      throw new Error('chunkSize must be greater than 0')
    }
    if (this.chunkOverlap < 0) {
      throw new Error('chunkOverlap must be greater than or equal to 0')
    }
    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('chunkOverlap must be less than chunkSize')
    }
  }

  private createChunk(
    document: Document,
    chunk: ChunkPosition,
    index: number
  ): Chunk {
    const start = chunk.start
    const end = chunk.start + chunk.text.length

    return {
      id: `${document.id}-chunk-${index}`,
      content: chunk.text,
      metadata: {
        start,
        end,
        index,
        documentId: document.id,
      },
    }
  }

  private splitText(text: string): ChunkPosition[] {
    const splits = this.splitTextRecursive(text, this.separators)
    return this.trackChunkPositions(splits, text)
  }

  private trackChunkPositions(splits: string[], text: string): ChunkPosition[] {
    const chunks: ChunkPosition[] = []
    let currentPosition = 0

    for (const split of splits) {
      const index = text.indexOf(split, currentPosition)
      if (index !== -1) {
        chunks.push({ text: split, start: index })
        currentPosition = index + split.length
      } else {
        chunks.push({ text: split, start: currentPosition })
        currentPosition += split.length
      }
    }

    return chunks
  }

  private splitTextRecursive(text: string, separators: string[]): string[] {
    const { separator, remainingSeparators } = this.findApplicableSeparator(
      text,
      separators
    )

    const splits = this.splitBySeparator(text, separator)

    return this.processSplits(splits, separator, remainingSeparators)
  }

  private findApplicableSeparator(
    text: string,
    separators: string[]
  ): SeparatorResult {
    for (let i = 0; i < separators.length; i++) {
      const separator = separators[i]
      if (separator === '' || text.includes(separator)) {
        return {
          separator,
          remainingSeparators: separators.slice(i + 1),
        }
      }
    }

    return {
      separator: separators[separators.length - 1],
      remainingSeparators: [],
    }
  }

  private splitBySeparator(text: string, separator: string): string[] {
    if (separator === '') {
      return text.split('')
    }
    return this.splitWithSeparator(text, separator)
  }

  private splitWithSeparator(text: string, separator: string): string[] {
    const parts = text.split(separator)
    const splits = parts.map((part, i) => {
      const isLastPart = i === parts.length - 1
      return this.keepSeparator && !isLastPart ? part + separator : part
    })

    return splits.filter((s) => s !== '')
  }

  private processSplits(
    splits: string[],
    separator: string,
    remainingSeparators: string[]
  ): string[] {
    const finalChunks: string[] = []
    const goodSplits: string[] = []

    for (const split of splits) {
      if (this.isUnderChunkSize(split)) {
        goodSplits.push(split)
      } else {
        this.flushGoodSplits(goodSplits, separator, finalChunks)
        this.handleOversizedSplit(split, remainingSeparators, finalChunks)
      }
    }

    this.flushGoodSplits(goodSplits, separator, finalChunks)

    return finalChunks
  }

  private isUnderChunkSize(text: string): boolean {
    return this.lengthFunction(text) < this.chunkSize
  }

  private flushGoodSplits(
    goodSplits: string[],
    separator: string,
    output: string[]
  ): void {
    if (goodSplits.length === 0) return

    const mergedSeparator = this.keepSeparator ? '' : separator
    const merged = this.mergeSmallSplits(goodSplits, mergedSeparator)
    output.push(...merged)
    goodSplits.length = 0
  }

  private handleOversizedSplit(
    split: string,
    remainingSeparators: string[],
    output: string[]
  ): void {
    if (remainingSeparators.length > 0) {
      const recursiveSplits = this.splitTextRecursive(
        split,
        remainingSeparators
      )
      output.push(...recursiveSplits)
    } else if (split !== '') {
      output.push(split)
    }
  }

  private mergeSmallSplits(splits: string[], separator: string): string[] {
    const separatorLength = this.lengthFunction(separator)
    const chunks: string[] = []
    const currentChunk: string[] = []
    let currentLength = 0

    for (const split of splits) {
      const splitLength = this.lengthFunction(split)

      if (
        this.shouldFinalizeChunk(
          currentChunk,
          currentLength,
          splitLength,
          separatorLength
        )
      ) {
        chunks.push(this.finalizeChunk(currentChunk, separator))
        currentLength = this.applyOverlap(
          currentChunk,
          currentLength,
          splitLength,
          separatorLength
        )
      }

      this.addSplitToChunk(currentChunk, split)
      currentLength += this.calculateAddedLength(
        currentChunk.length,
        splitLength,
        separatorLength
      )
    }

    if (currentChunk.length > 0) {
      chunks.push(this.finalizeChunk(currentChunk, separator))
    }

    return chunks
  }

  private shouldFinalizeChunk(
    currentChunk: string[],
    currentLength: number,
    splitLength: number,
    separatorLength: number
  ): boolean {
    if (currentChunk.length === 0) return false

    const potentialLength =
      currentLength +
      splitLength +
      (currentChunk.length > 0 ? separatorLength : 0)

    return potentialLength > this.chunkSize
  }

  private finalizeChunk(chunk: string[], separator: string): string {
    return chunk.join(separator)
  }

  private applyOverlap(
    currentChunk: string[],
    currentLength: number,
    nextSplitLength: number,
    separatorLength: number
  ): number {
    let length = currentLength

    while (
      this.shouldRemoveFromChunk(
        currentChunk,
        length,
        nextSplitLength,
        separatorLength
      )
    ) {
      const removed = currentChunk.shift()!
      length -= this.lengthFunction(removed)
      if (currentChunk.length > 0) {
        length -= separatorLength
      }
    }

    return length
  }

  private shouldRemoveFromChunk(
    currentChunk: string[],
    currentLength: number,
    nextSplitLength: number,
    separatorLength: number
  ): boolean {
    if (currentChunk.length === 0) return false

    const exceedsOverlap = currentLength > this.chunkOverlap
    const wouldExceedWithNext =
      currentLength + nextSplitLength + separatorLength > this.chunkSize &&
      currentLength > 0

    return exceedsOverlap || wouldExceedWithNext
  }

  private addSplitToChunk(chunk: string[], split: string): void {
    chunk.push(split)
  }

  private calculateAddedLength(
    chunkLength: number,
    splitLength: number,
    separatorLength: number
  ): number {
    return splitLength + (chunkLength > 1 ? separatorLength : 0)
  }
}
