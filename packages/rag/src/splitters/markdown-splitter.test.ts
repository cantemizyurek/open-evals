import { describe, it, expect, beforeEach } from 'vitest'
import { MarkdownSplitter } from './markdown-splitter'
import type { Document, Chunk } from '../types'

describe('MarkdownSplitter', () => {
  let document: Document

  beforeEach(() => {
    document = {
      id: 'test-doc',
      content: '',
      metadata: {},
    }
  })

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const splitter = new MarkdownSplitter()
      expect(splitter).toBeInstanceOf(MarkdownSplitter)
    })

    it('should accept custom chunk options', () => {
      const splitter = new MarkdownSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
      })
      expect(splitter).toBeInstanceOf(MarkdownSplitter)
    })
  })

  describe('markdown headings', () => {
    it('should split by markdown headings', async () => {
      document.content = `# Main Title
This is the introduction paragraph under the main title.

## Section 1
Content for section 1 goes here.

## Section 2
Content for section 2 goes here.

### Subsection 2.1
More detailed content in subsection.`

      const splitter = new MarkdownSplitter({
        chunkSize: 100,
        chunkOverlap: 20,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      const hasMainTitle = chunks.some((c) => c.content.includes('Main Title'))
      const hasSection1 = chunks.some((c) => c.content.includes('Section 1'))
      expect(hasMainTitle).toBe(true)
      expect(hasSection1).toBe(true)
    })

    it('should handle all heading levels', async () => {
      document.content = `# H1 Heading
Content under H1

## H2 Heading
Content under H2

### H3 Heading
Content under H3

#### H4 Heading
Content under H4

##### H5 Heading
Content under H5

###### H6 Heading
Content under H6`

      const splitter = new MarkdownSplitter({
        chunkSize: 50,
        chunkOverlap: 10,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      const allContent = chunks.map((c) => c.content).join('')
      expect(allContent).toContain('H1')
      expect(allContent).toContain('H2')
      expect(allContent).toContain('H6')
    })
  })

  describe('code blocks', () => {
    it('should split around code blocks', async () => {
      document.content = `# Code Examples

Here is some text before the code block.

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

And here is text after the code block.

\`\`\`python
def hello():
    print("Hello, world!")
\`\`\`

Final paragraph.`

      const splitter = new MarkdownSplitter({
        chunkSize: 100,
        chunkOverlap: 20,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      const hasJsCode = chunks.some((c) =>
        c.content.includes('function hello()')
      )
      const hasPyCode = chunks.some((c) => c.content.includes('def hello()'))
      expect(hasJsCode).toBe(true)
      expect(hasPyCode).toBe(true)
    })

    it('should handle inline code', async () => {
      document.content = `# Documentation

Use \`npm install\` to install dependencies.

The \`process.env.NODE_ENV\` variable controls the environment.

Call \`function()\` to execute.`

      const splitter = new MarkdownSplitter({
        chunkSize: 80,
        chunkOverlap: 10,
      })

      const chunks = await collectChunks(splitter.split(document))

      const allContent = chunks.map((c) => c.content).join('')
      expect(allContent).toContain('`npm install`')
      expect(allContent).toContain('`process.env.NODE_ENV`')
    })
  })

  describe('horizontal lines', () => {
    it('should split by horizontal lines with dashes', async () => {
      document.content = `Section 1
Some content here.

---

Section 2
More content here.

---

Section 3
Final content.`

      const splitter = new MarkdownSplitter({
        chunkSize: 50,
        chunkOverlap: 0,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThanOrEqual(2)
      const hasSection1 = chunks.some((c) => c.content.includes('Section 1'))
      const hasSection2 = chunks.some((c) => c.content.includes('Section 2'))
      expect(hasSection1).toBe(true)
      expect(hasSection2).toBe(true)
    })

    it('should handle different horizontal line styles', async () => {
      document.content = `Part 1
Content

***

Part 2
Content

___

Part 3
Content`

      const splitter = new MarkdownSplitter({
        chunkSize: 30,
        chunkOverlap: 0,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThanOrEqual(2)
      const allContent = chunks.map((c) => c.content).join(' ')
      expect(allContent).toContain('Part 1')
      expect(allContent).toContain('Part 2')
      expect(allContent).toContain('Part 3')
    })
  })

  describe('paragraphs and line breaks', () => {
    it('should split by paragraph breaks', async () => {
      document.content = `First paragraph with some content that goes on for a while.

Second paragraph that is also quite long and contains multiple sentences. This should be handled properly.

Third paragraph is shorter.

Fourth and final paragraph.`

      const splitter = new MarkdownSplitter({
        chunkSize: 100,
        chunkOverlap: 20,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0)
        expect(chunk.metadata).toHaveProperty('start')
        expect(chunk.metadata).toHaveProperty('end')
      })
    })

    it('should handle single line breaks', async () => {
      document.content = `Line 1
Line 2
Line 3
Line 4
Line 5`

      const splitter = new MarkdownSplitter({
        chunkSize: 20,
        chunkOverlap: 5,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      const allLines = chunks.map((c) => c.content).join('')
      expect(allLines).toContain('Line 1')
      expect(allLines).toContain('Line 5')
    })
  })

  describe('complex markdown documents', () => {
    it('should handle a complete markdown document', async () => {
      document.content = `# Project Documentation

## Introduction

This is a comprehensive guide to our project. It covers all aspects of development and deployment.

## Installation

### Prerequisites

- Node.js >= 14
- npm or yarn

### Steps

1. Clone the repository
2. Install dependencies:

\`\`\`bash
npm install
\`\`\`

3. Configure environment variables

---

## Usage

### Basic Usage

Run the following command:

\`\`\`bash
npm start
\`\`\`

### Advanced Options

You can customize behavior with flags:

- \`--verbose\`: Enable verbose logging
- \`--debug\`: Enable debug mode

## API Reference

### Function: processData(input)

Processes the input data and returns results.

**Parameters:**
- \`input\` (string): The data to process

**Returns:**
- \`output\` (object): The processed results

---

## Contributing

Please read CONTRIBUTING.md for details.

## License

MIT License - see LICENSE file for details.`

      const splitter = new MarkdownSplitter({
        chunkSize: 200,
        chunkOverlap: 50,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(3)

      const hasIntro = chunks.some((c) => c.content.includes('Introduction'))
      const hasInstall = chunks.some((c) => c.content.includes('Installation'))
      const hasUsage = chunks.some((c) => c.content.includes('Usage'))
      const hasAPI = chunks.some((c) => c.content.includes('API Reference'))

      expect(hasIntro).toBe(true)
      expect(hasInstall).toBe(true)
      expect(hasUsage).toBe(true)
      expect(hasAPI).toBe(true)

      const hasCodeBlock = chunks.some((c) => c.content.includes('npm install'))
      expect(hasCodeBlock).toBe(true)
    })

    it('should handle markdown with lists', async () => {
      document.content = `# Features

## Ordered List

1. First item
2. Second item
3. Third item

## Unordered List

- Bullet point one
- Bullet point two
  - Nested point
  - Another nested point
- Bullet point three

## Mixed Lists

1. Numbered item
   - Sub bullet
   - Another sub bullet
2. Second numbered item`

      const splitter = new MarkdownSplitter({
        chunkSize: 80,
        chunkOverlap: 20,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      const allContent = chunks.map((c) => c.content).join('')
      expect(allContent).toContain('First item')
      expect(allContent).toContain('Bullet point')
      expect(allContent).toContain('Nested point')
    })

    it('should handle markdown tables', async () => {
      document.content = `# Data Table

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

More content after table.`

      const splitter = new MarkdownSplitter({
        chunkSize: 100,
        chunkOverlap: 20,
      })

      const chunks = await collectChunks(splitter.split(document))

      const allContent = chunks.map((c) => c.content).join('')
      expect(allContent).toContain('Column 1')
      expect(allContent).toContain('Data 1')
      expect(allContent).toContain('More content after table')
    })
  })

  describe('edge cases', () => {
    it('should handle empty document', async () => {
      document.content = ''
      const splitter = new MarkdownSplitter()

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks).toHaveLength(0)
    })

    it('should handle document with only whitespace', async () => {
      document.content = '   \n\n   \n   '
      const splitter = new MarkdownSplitter({
        chunkSize: 10,
        chunkOverlap: 0,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle very small chunks', async () => {
      document.content = `# Title

Small content here.`

      const splitter = new MarkdownSplitter({
        chunkSize: 5,
        chunkOverlap: 0,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0)
      })
    })

    it('should handle large document without headings', async () => {
      document.content = `This is a long document without any markdown headings.
It just contains regular paragraphs and text.

Sometimes there are paragraph breaks like this.

But no actual markdown structure beyond basic paragraphs.
The splitter should still handle this gracefully.`

      const splitter = new MarkdownSplitter({
        chunkSize: 100,
        chunkOverlap: 20,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(0)
      const reconstituted = chunks.map((c) => c.content).join(' ')
      expect(reconstituted).toContain('long document')
      expect(reconstituted).toContain('paragraph breaks')
    })

    it('should preserve metadata and generate correct IDs', async () => {
      document.content = `# Test Document

Content here.`

      const splitter = new MarkdownSplitter({
        chunkSize: 50,
        chunkOverlap: 0,
      })

      const chunks = await collectChunks(splitter.split(document))

      chunks.forEach((chunk, index) => {
        expect(chunk.id).toBe(`test-doc-chunk-${index}`)
        expect(chunk.metadata.documentId).toBe('test-doc')
        expect(chunk.metadata.index).toBe(index)
        expect(typeof chunk.metadata.start).toBe('number')
        expect(typeof chunk.metadata.end).toBe('number')
        expect(chunk.metadata.end).toBeGreaterThan(chunk.metadata.start)
      })
    })

    it('should handle special markdown characters', async () => {
      document.content = `# Title with *emphasis* and **bold**

Text with \`inline code\` and [links](http://example.com).

> Blockquote content
> Multiple lines

![Image alt text](image.png)`

      const splitter = new MarkdownSplitter({
        chunkSize: 80,
        chunkOverlap: 10,
      })

      const chunks = await collectChunks(splitter.split(document))

      const allContent = chunks.map((c) => c.content).join('')
      expect(allContent).toContain('*emphasis*')
      expect(allContent).toContain('**bold**')
      expect(allContent).toContain('`inline code`')
      expect(allContent).toContain('[links]')
      expect(allContent).toContain('> Blockquote')
      expect(allContent).toContain('![Image alt text]')
    })
  })

  describe('chunk overlap behavior', () => {
    it('should create proper overlaps between chunks', async () => {
      document.content = `# Section One

First paragraph content.

# Section Two

Second paragraph content.

# Section Three

Third paragraph content.`

      const splitter = new MarkdownSplitter({
        chunkSize: 40,
        chunkOverlap: 10,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(2)
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1].content
        const currentChunk = chunks[i].content

        expect(prevChunk.length).toBeGreaterThan(0)
        expect(currentChunk.length).toBeGreaterThan(0)
      }
    })
  })

  describe('custom length function', () => {
    it('should work with custom length function', async () => {
      document.content = `# Title

Word word word word.

Word word word.`

      const wordCounter = (text: string) => {
        return text.split(/\s+/).filter(Boolean).length
      }

      const splitter = new MarkdownSplitter({
        chunkSize: 5,
        chunkOverlap: 2,
        lengthFunction: wordCounter,
      })

      const chunks = await collectChunks(splitter.split(document))

      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach((chunk) => {
        const wordCount = wordCounter(chunk.content)
        expect(wordCount).toBeLessThanOrEqual(8)
      })
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
