import {
  graph,
  chunk,
  embed,
  relationship,
  DocumentNode,
  summarize,
  embedProperty,
  transform,
  tap,
  generatePersonas,
  SingleHopScenarioBuilder,
} from './src'
import { RecursiveCharacterSplitter } from '@ai-sdk-eval/rag'
import { openai } from '@ai-sdk/openai'
import { readFile, readdir } from 'node:fs/promises'
import 'dotenv/config'
import { generateScenarios } from './src/scenario/scenario-builder'

const dataFolder = './data'

const files = await readdir(dataFolder)

const documents = await Promise.all(
  files.map(async (file) => {
    const content = await readFile(`${dataFolder}/${file}`, 'utf-8')
    return new DocumentNode(file, content, {})
  })
)

const g = await transform(graph(documents))
  .pipe(summarize(openai.chat('gpt-4.1')))
  .pipe(
    embedProperty(openai.embedding('text-embedding-3-small'), {
      embedProperty: 'summary',
      propertyName: 'summaryEmbedding',
      filter: (node) => node.type === 'document',
    })
  )
  .pipe(chunk(new RecursiveCharacterSplitter()))
  .pipe(embed(openai.embedding('text-embedding-3-small')))
  .pipe(relationship())
  .apply()

const personas = await generatePersonas(g, openai.chat('gpt-4.1'))

const scenarios = generateScenarios(g, personas[0], 2, 'single-hop')

console.log(scenarios)
