import {
  graph,
  chunk,
  embed,
  relationship,
  DocumentNode,
  summarize,
  embedProperty,
  transform,
  generatePersonas,
  synthesize,
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

const g = await transform(graph(documents))
  .pipe(summarize(openai.chat('gpt-4o')))
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

console.log(g.getNodes().length)

const personas = await generatePersonas(g, openai.chat('gpt-4o'), {
  numPersonas: 3,
})

console.log(`Generated ${personas.length} personas:`)
personas.forEach((p) => console.log(`- ${p.name}`))

console.log('\nGenerating test samples...')
const testSamples = await synthesize(g, openai.chat('gpt-4o'), personas, 10, {
  distribution: {
    'single-hop-specific': 50,
    'multi-hop-abstract': 25,
    'multi-hop-specific': 25,
  },
  generateGroundTruth: true,
  concurrency: 3,
})

console.log(`\nGenerated ${testSamples.length} test samples:\n`)
testSamples.forEach((sample, i) => {
  console.log(`Sample ${i + 1}:`)
  console.log(`Question: ${sample.query}`)
  console.log(`Contexts: ${sample.retrievedContexts?.length ?? 0} chunks`)
  console.log(`Ground Truth: ${sample.reference?.substring(0, 100)}...`)
  console.log(`Metadata:`, sample.metadata)
  console.log()
})
