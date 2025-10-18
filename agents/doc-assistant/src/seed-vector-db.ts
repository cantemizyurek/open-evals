import { importFiles } from './imprort-files'
import { MarkdownSplitter } from '@open-evals/rag'
import { Index } from '@upstash/vector'
import { openai } from '@ai-sdk/openai'
import { embed, embedMany } from 'ai'

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
})

const FOLDER_PATH = new URL('../../../apps/docs/content/docs', import.meta.url)
  .pathname
const documents = await importFiles(FOLDER_PATH)

const splitter = new MarkdownSplitter({
  chunkSize: 800 * 3,
  chunkOverlap: 100,
})

const chunks = []
for (const document of documents) {
  const splits = splitter.split(document)
  for await (const split of splits) {
    chunks.push(split)
  }
}

const embeddings = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks.map((chunk) => chunk.content),
})

for (let i = 0; i < chunks.length; i++) {
  await index.upsert({
    id: chunks[i].id,
    data: chunks[i].content,
    vector: embeddings.embeddings[i],
  })
}

console.log(`Seeded ${chunks.length} chunks`)
