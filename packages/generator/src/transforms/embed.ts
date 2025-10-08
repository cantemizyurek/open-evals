import type { EmbeddingModel } from 'ai'
import { embedMany } from 'ai'
import type { Transform } from '../types'
import type { KnowledgeGraph } from '../graph/knowledge-graph'
import { ChunkNode } from '../graph/node'

export type Embedding = number[]

/**
 * Embed the chunk nodes in the graph by their content
 *
 * @param model - The embedding model to use
 */
export function embed<T extends object>(
  model: EmbeddingModel
): Transform<T, T & { embeddings?: Embedding }> {
  return {
    name: 'embed',
    description: 'Embed the nodes in the graph',
    async apply(
      graph: KnowledgeGraph<T>
    ): Promise<KnowledgeGraph<T & { embeddings?: Embedding }>> {
      const nodes = graph.getNodesByType('chunk')
      if (nodes.length === 0)
        return graph as KnowledgeGraph<T & { embeddings?: Embedding }>

      const nodesToEmbed = nodes.filter(
        (node) => node.content.trim().length > 0
      )

      const nodesContent = nodesToEmbed.map((node) => node.content)
      const { embeddings } = await embedMany({
        model,
        values: nodesContent,
      })

      for (let i = 0; i < nodesToEmbed.length; i++) {
        nodesToEmbed[i].metadata = {
          ...nodesToEmbed[i].metadata,
          embeddings: embeddings[i],
        } as T & { embeddings?: Embedding }
      }

      return graph as KnowledgeGraph<T & { embeddings?: Embedding }>
    },
  }
}
