import { openai } from '@ai-sdk/openai'
import {
  embed,
  ModelMessage,
  generateText,
  Tool,
  stepCountIs,
  streamText,
  Experimental_Agent as Agent,
} from 'ai'
import { z } from 'zod'
import { Index } from '@upstash/vector'
import { CohereClient } from 'cohere-ai'

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
})

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
})

const SearchToolSchema = z.object({
  query: z.string().describe('The query to search the documentation'),
})

export const docAssistant = new Agent({
  model: openai('gpt-4.1-mini'),
  system: `You are a documentation assistant that provides accurate, faithful answers based on the available documentation.

Open Evals is a library for generating synthetic test data for your LLM applications and evaluating their performance.

Guidelines:
- Use the search tool to find relevant information before answering questions
- Base your answers ONLY on information found in the documentation through search results
- Provide concise, direct answers that accurately reflect the documentation content
- If information is not available in the documentation, clearly state that you don't have that information
- Cite specific details from the search results when answering
- Do not make assumptions or add information not present in the retrieved documentation
- If the search results are incomplete or unclear, perform additional searches with refined queries
- Maintain accuracy over completeness - it's better to give a partial but correct answer than a complete but inaccurate one`,
  stopWhen: stepCountIs(10),
  tools: {
    search: {
      inputSchema: SearchToolSchema,
      description: 'Search the documentation',
      execute: async ({ query }) => {
        const embedding = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: query,
        })
        const result = await index.query({
          vector: embedding.embedding,
          topK: 10,
          includeData: true,
        })

        const reranked = await cohere.rerank({
          model: 'rerank-english-v3.0',
          documents: result.map((r) => ({
            id: r.id.toString(),
            text: r.data ?? '',
          })),
          query: query,
          returnDocuments: true,
          topN: 3,
        })

        return reranked.results.map((r) => ({
          text: r.document?.text,
          score: r.relevanceScore,
        }))
      },
    },
  },
})
