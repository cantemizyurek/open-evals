import type { LanguageModel } from 'ai'
import { generateObject, cosineSimilarity } from 'ai'
import { z } from 'zod'
import type { KnowledgeGraph } from '../graph/knowledge-graph'
import type { GraphNode } from '../graph/node'
import type { Persona, GeneratePersonasOptions } from './type'
import { pLimit } from '@ai-sdk-eval/core'

const PersonaSchema = z.object({
  name: z
    .string()
    .describe(
      'The role or title of the persona (e.g., "Senior Software Engineer", "Product Manager")'
    ),
  description: z
    .string()
    .describe(
      'A detailed description of the persona including their background, knowledge level, goals'
    ),
})

function selectRepresentativeSummaries<T extends object>(
  nodes: Array<
    GraphNode<T> & {
      metadata: T & { summary: string; summaryEmbedding: number[] }
    }
  >,
  similarityThreshold: number = 0.75
): Array<{ node: GraphNode<T>; summary: string }> {
  if (nodes.length === 0) return []

  const clusters: Array<Array<(typeof nodes)[0]>> = []

  for (const node of nodes) {
    let addedToCluster = false

    for (const cluster of clusters) {
      const representative = cluster[0]
      const similarity = cosineSimilarity(
        node.metadata.summaryEmbedding,
        representative.metadata.summaryEmbedding
      )

      if (similarity >= similarityThreshold) {
        cluster.push(node)
        addedToCluster = true
        break
      }
    }

    if (!addedToCluster) {
      clusters.push([node])
    }
  }

  return clusters.map((cluster) => {
    const representative = cluster.reduce((longest, current) =>
      current.metadata.summary.length > longest.metadata.summary.length
        ? current
        : longest
    )
    return {
      node: representative,
      summary: representative.metadata.summary,
    }
  })
}

/**
 * Generate diverse personas from a knowledge graph using an LLM
 *
 * @param kg - The knowledge graph to analyze
 * @param model - The language model to use for generation
 * @param options - Configuration options
 * @returns Array of generated personas
 */
export async function generatePersonas<
  T extends {
    summary?: string
    summaryEmbedding?: number[]
  }
>(
  kg: KnowledgeGraph<T>,
  model: LanguageModel,
  options?: GeneratePersonasOptions
): Promise<Persona[]> {
  const { count, concurrency = 5 } = options || {}

  const nodesWithEmbeddings = kg.getNodes().filter(
    (
      node
    ): node is GraphNode<T> & {
      metadata: T & { summary: string; summaryEmbedding: number[] }
    } => {
      if (!node.metadata) return false
      const meta = node.metadata as Record<string, unknown>
      return (
        typeof meta.summary === 'string' &&
        meta.summary.trim().length > 0 &&
        Array.isArray(meta.summaryEmbedding) &&
        meta.summaryEmbedding.length > 0
      )
    }
  )

  if (nodesWithEmbeddings.length === 0) {
    throw new Error(
      'No nodes with summary embeddings found. Ensure you run summarize() and embedProperty() transforms before generating personas.'
    )
  }

  const representatives = selectRepresentativeSummaries(nodesWithEmbeddings)

  if (representatives.length === 0) {
    throw new Error('No representative summaries found for persona generation.')
  }

  const selectedRepresentatives = count
    ? Array.from(
        { length: count },
        (_, i) => representatives[i % representatives.length]
      )
    : representatives

  const personaPromises = await pLimit(
    selectedRepresentatives,
    async ({ summary }) => {
      try {
        const result = await generateObject({
          model,
          schema: PersonaSchema,
          prompt: `
Using the provided summary, generate a single persona who would likely interact with or benefit from the content with the given expertise level.

Expertise level: 
${expertiseLevel()}

Summary:
${summary}

Generate a persona with:
- A role or job title (e.g., "Senior Software Engineer", "Product Manager", "Data Scientist") - do NOT include a human name
- A concise description of who they are, their background, knowledge level and goals

Provide a realistic and specific persona based on this content with the given expertise level.
`.trim(),
        })

        return result.object
      } catch (error) {
        console.error('Failed to generate persona:', error)
        return null
      }
    },
    concurrency
  )

  const personas = personaPromises.filter((p): p is Persona => p !== null)

  if (personas.length === 0) {
    throw new Error('Failed to generate any personas.')
  }

  return personas
}

function expertiseLevel(): 'beginner' | 'intermediate' | 'expert' {
  return Math.random() < 0.33
    ? 'beginner'
    : Math.random() < 0.66
    ? 'intermediate'
    : 'expert'
}
