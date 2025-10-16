import { describe, it, expect, beforeEach } from 'vitest'
import { RecursiveCharacterSplitter } from './recursive-character'
import type { Document, Chunk } from '../types'

describe('RecursiveCharacterSplitter', () => {
  let document: Document

  beforeEach(() => {
    document = {
      id: 'test-doc',
      content: '',
      metadata: {},
    }
  })

  describe('constructor and validation', () => {
    it('should create instance with default options', () => {
      const splitter = new RecursiveCharacterSplitter()
      expect(splitter).toBeInstanceOf(RecursiveCharacterSplitter)
    })

    it('should throw error for invalid chunk size', () => {
      expect(() => new RecursiveCharacterSplitter({ chunkSize: 0 })).toThrow(
        'chunkSize must be greater than 0'
      )
      expect(() => new RecursiveCharacterSplitter({ chunkSize: -1 })).toThrow(
        'chunkSize must be greater than 0'
      )
    })

    it('should throw error for invalid chunk overlap', () => {
      expect(
        () => new RecursiveCharacterSplitter({ chunkOverlap: -1 })
      ).toThrow('chunkOverlap must be greater than or equal to 0')
    })

    it('should throw error when overlap exceeds chunk size', () => {
      expect(
        () =>
          new RecursiveCharacterSplitter({
            chunkSize: 100,
            chunkOverlap: 100,
          })
      ).toThrow('chunkOverlap must be less than chunkSize')
    })
  })

  describe('basic splitting', () => {
    it('should split text by default separators', async () => {
      document.content =
        'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 20,
        chunkOverlap: 0,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].content).toContain('First paragraph')
      expect(chunks[0].metadata.documentId).toBe('test-doc')
      expect(chunks[0].metadata.index).toBe(0)
    })

    it('should handle empty text', async () => {
      document.content = ''
      const splitter = new RecursiveCharacterSplitter()

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks).toHaveLength(0)
    })

    it('should handle text smaller than chunk size', async () => {
      document.content = 'Small text'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 100,
        chunkOverlap: 20,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks).toHaveLength(1)
      expect(chunks[0].content).toBe('Small text')
      expect(chunks[0].metadata.start).toBe(0)
      expect(chunks[0].metadata.end).toBe(10)
    })

    it('should split text with custom separators', async () => {
      document.content = 'word1;word2;word3;word4'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 10,
        chunkOverlap: 0,
        separators: [';', ''],
        keepSeparator: false,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every((c) => !c.content.includes(';'))).toBe(true)
    })
  })

  describe('keepSeparator modes', () => {
    const content = 'line1\nline2\nline3\nline4'

    it('should keep separator at end when keepSeparator=true', async () => {
      document.content = content
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 12,
        chunkOverlap: 0,
        separators: ['\n'],
        keepSeparator: true,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks[0].content).toMatch(/\n$/)
    })

    it('should keep separator at end when keepSeparator="end"', async () => {
      document.content = content
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 12,
        chunkOverlap: 0,
        separators: ['\n'],
        keepSeparator: 'end',
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks[0].content).toMatch(/\n$/)
    })

    it('should keep separator at start when keepSeparator="start"', async () => {
      document.content = content
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 12,
        chunkOverlap: 0,
        separators: ['\n'],
        keepSeparator: 'start',
      })

      const chunks = await collectChunks(splitter.split(document))

      if (chunks.length > 1) {
        expect(chunks[1].content).toMatch(/^\n/)
      }
    })

    it('should remove separators when keepSeparator=false', async () => {
      document.content = content
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 12,
        chunkOverlap: 0,
        separators: ['\n'],
        keepSeparator: false,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.every((c) => !c.content.includes('\n'))).toBe(true)
    })
  })

  describe('regex separator support', () => {
    it('should split using regex patterns', async () => {
      document.content =
        'function foo() {}\n\nfunction bar() {}\n\nfunction baz() {}'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 25,
        chunkOverlap: 0,
        separators: ['\\nfunction\\s+\\w+\\(\\)', '\n', ' ', ''],
        isSeparatorRegex: true,
        keepSeparator: 'start',
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      const functionsFound = chunks.filter((c) =>
        c.content.includes('function')
      )
      expect(functionsFound.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle markdown headers with regex', async () => {
      document.content =
        '# Header 1\nContent 1\n\n## Header 2\nContent 2\n\n### Header 3\nContent 3'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 30,
        chunkOverlap: 0,
        separators: ['\\n#{1,6}\\s', '\n\n', '\n', ' ', ''],
        isSeparatorRegex: true,
        keepSeparator: 'start',
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThanOrEqual(2)
      const headersFound = chunks.filter((c) => c.content.includes('#'))
      expect(headersFound.length).toBeGreaterThanOrEqual(2)
    })

    it('should escape special characters when not in regex mode', async () => {
      document.content = 'item1.*item2.*item3'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 10,
        chunkOverlap: 0,
        separators: ['.*'],
        isSeparatorRegex: false,
        keepSeparator: false,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks).toHaveLength(3)
      expect(chunks[0].content).toBe('item1')
      expect(chunks[1].content).toBe('item2')
      expect(chunks[2].content).toBe('item3')
    })

    it('should treat .* as regex when in regex mode', async () => {
      document.content = 'item1XXXitem2YYYitem3'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 3,
        chunkOverlap: 0,
        separators: ['item.'],
        isSeparatorRegex: true,
        keepSeparator: false,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.some((c) => c.content.includes('XXX'))).toBe(true)
      expect(chunks.some((c) => c.content.includes('YYY'))).toBe(true)
    })
  })

  describe('chunk overlap', () => {
    it('should create overlapping chunks', async () => {
      document.content = 'word1 word2 word3 word4 word5 word6'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 12,
        chunkOverlap: 6,
        separators: [' '],
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      for (let i = 1; i < chunks.length; i++) {
        const prevEnd = chunks[i - 1].content.slice(-5)
        const currentStart = chunks[i].content.slice(0, 5)
        expect(chunks[i - 1].content).toContain(currentStart.split(' ')[0])
      }
    })

    it('should handle zero overlap', async () => {
      document.content = 'word1 word2 word3 word4'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 12,
        chunkOverlap: 0,
        separators: [' '],
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThanOrEqual(2)
      const allContent = chunks.map((c) => c.content).join('')
      expect(allContent.length).toBeLessThanOrEqual(
        document.content.length + chunks.length
      )
    })
  })

  describe('position tracking', () => {
    it('should track chunk positions correctly', async () => {
      document.content = 'First. Second. Third.'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 10,
        chunkOverlap: 0,
        separators: ['. ', ''],
        keepSeparator: false,
      })

      const chunks = await collectChunks(splitter.split(document))

      for (const chunk of chunks) {
        const expectedContent = document.content.substring(
          chunk.metadata.start,
          chunk.metadata.end
        )
        expect(chunk.content).toBe(expectedContent)
      }
    })

    it('should generate unique chunk IDs', async () => {
      document.content = 'text1 text2 text3'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 6,
        chunkOverlap: 0,
      })

      const chunks = await collectChunks(splitter.split(document))

      const ids = chunks.map((c) => c.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)

      expect(chunks[0].id).toBe('test-doc-chunk-0')
      expect(chunks[1].id).toBe('test-doc-chunk-1')
    })
  })

  describe('recursive splitting', () => {
    it('should recursively split with multiple separator levels', async () => {
      document.content =
        'Para1 sentence1. Para1 sentence2.\n\nPara2 sentence1. Para2 sentence2.'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 20,
        chunkOverlap: 0,
        separators: ['\n\n', '. ', ' ', ''],
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(2)
    })

    it('should handle oversized chunks that cannot be split further', async () => {
      document.content = 'verylongwordwithoutanybreaks'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 10,
        chunkOverlap: 0,
        separators: [' ', '\n'],
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks).toHaveLength(1)
      expect(chunks[0].content).toBe('verylongwordwithoutanybreaks')
    })
  })

  describe('custom length function', () => {
    it('should use custom length function', async () => {
      document.content = 'word1 word2 word3 word4'
      const customLength = (text: string) =>
        text.split(/\s+/).filter(Boolean).length

      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 2,
        chunkOverlap: 1,
        separators: [' '],
        lengthFunction: customLength,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThanOrEqual(2)
      chunks.forEach((chunk) => {
        const wordCount = customLength(chunk.content)
        expect(wordCount).toBeLessThanOrEqual(2)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle text with only separators', async () => {
      document.content = '\n\n\n\n'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 10,
        chunkOverlap: 0,
        separators: ['\n'],
        keepSeparator: true,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle single character chunks', async () => {
      document.content = 'abcd'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 1,
        chunkOverlap: 0,
        separators: [''],
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks).toHaveLength(4)
      expect(chunks[0].content).toBe('a')
      expect(chunks[1].content).toBe('b')
      expect(chunks[2].content).toBe('c')
      expect(chunks[3].content).toBe('d')
    })

    it('should handle Unicode characters correctly', async () => {
      document.content = '你好世界 Hello 世界'
      const splitter = new RecursiveCharacterSplitter({
        chunkSize: 5,
        chunkOverlap: 0,
        separators: [' '],
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(0)
      const allContent = chunks.map((c) => c.content).join(' ')
      expect(allContent).toContain('你好')
      expect(allContent).toContain('世界')
    })
  })
})

async function collectChunks(
  generator: AsyncGenerator<Chunk>
): Promise<Chunk[]> {
  const chunks: Chunk[] = []
  for await (const chunk of generator) {
    chunks.push(chunk)
  }
  return chunks
}
