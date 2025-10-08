import {
  graph,
  chunk,
  embed,
  relationship,
  transform,
  DocumentNode,
} from './src'
import { RecursiveCharacterSplitter } from '@ai-sdk-eval/rag'
import { openai } from '@ai-sdk/openai'
import { readFile, readdir } from 'node:fs/promises'
import 'dotenv/config'

const dataFolder = './data'

const files = await readdir(dataFolder)

const documents = await Promise.all(
  files.map(async (file) => {
    const content = await readFile(`${dataFolder}/${file}`, 'utf-8')
    return new DocumentNode(file, content, {})
  })
)

const g = await transform(graph(documents), [
  chunk(new RecursiveCharacterSplitter()),
  embed(openai.embedding('text-embedding-3-small')),
  relationship(),
])

console.log(`Chunks: ${g.getNodesByType('chunk').length}`)
console.log(`Documents: ${g.getNodesByType('document').length}`)
