import { cosineSimilarity } from 'ai'
import type { KnowledgeGraph } from '../graph/knowledge-graph'
import type { Transform } from '../types'
import type { Embedding } from './embed'

/**
 * Build relationships between the nodes in the graph
 * based on cosine similarity of their embeddings.
 * Nodes without embeddings are skipped.
 *
 * @param threshold - The threshold for the similarity score
 */
export function relationship<T extends object>(
  threshold: number = 0.7
): Transform<T & { embeddings?: Embedding }, T & { embeddings?: Embedding }> {
  return {
    name: 'relationship',
    description: 'Build relationships between the nodes in the graph',
    async apply(
      graph: KnowledgeGraph<T & { embeddings?: Embedding }>
    ): Promise<KnowledgeGraph<T & { embeddings?: Embedding }>> {
      const nodes = graph
        .getNodes()
        .filter((node) => node.type === 'chunk' && node.metadata.embeddings)
      if (nodes.length === 0) return graph

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeI = nodes[i]
          const nodeJ = nodes[j]

          const similarity = cosineSimilarity(
            nodeI.metadata.embeddings as Embedding,
            nodeJ.metadata.embeddings as Embedding
          )

          if (similarity >= threshold) {
            graph.addRelationship(nodeI.id, nodeJ.id, {
              type: 'similarity',
              score: similarity,
            })
          }
        }
      }

      return graph
    },
  }
}
