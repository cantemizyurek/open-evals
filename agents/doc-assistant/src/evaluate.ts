import { evaluate } from '@open-evals/core'
import { FactualCorrectness, Faithfulness } from '@open-evals/metrics'
import { openai } from '@ai-sdk/openai'
import 'dotenv/config'
import {
  chunk,
  createSynthesizer,
  embed,
  embedProperty,
  generatePersonas,
  graph,
  relationship,
  summarize,
  synthesize,
  transform,
} from '@open-evals/generator'
import { DocumentNode } from '@open-evals/generator'
import { MarkdownSplitter } from '@open-evals/rag'
import { importFiles } from './imprort-files'
import { docAssistant } from './agent'

const FOLDER_PATH = new URL('../../../apps/docs/content/docs', import.meta.url)
  .pathname
const documents = (await importFiles(FOLDER_PATH)).map(
  (document) =>
    new DocumentNode(document.id, document.content, document.metadata)
)

const knowledgeGraph = await transform(graph(documents))
  .pipe(summarize(openai.chat('gpt-4.1')))
  .pipe(
    embedProperty(openai.embedding('text-embedding-3-small'), {
      embedProperty: 'summary',
      propertyName: 'summaryEmbedding',
    })
  )
  .pipe(
    chunk(
      new MarkdownSplitter({
        chunkSize: 800 * 3,
        chunkOverlap: 100,
      })
    )
  )
  .pipe(embed(openai.embedding('text-embedding-3-small')))
  .pipe(relationship())
  .apply()

const personas = await generatePersonas(knowledgeGraph, openai.chat('gpt-4.1'))

const testSamples = await synthesize({
  graph: knowledgeGraph,
  personas,
  synthesizers: [
    [createSynthesizer(openai.chat('gpt-4.1'), 'single-hop-specific'), 1],
  ],
  count: 10,
})

for await (const sample of testSamples) {
  if ('query' in sample && 'response' in sample) {
    const query = sample.query
    const response = await docAssistant.generate({
      messages: [{ role: 'user', content: query }],
    })
    sample.response = response.text
  }
}

const results = await evaluate(testSamples, [
  new FactualCorrectness({ model: openai.chat('gpt-4.1') }),
  new Faithfulness({ model: openai.chat('gpt-4.1') }),
])

console.log(results)
