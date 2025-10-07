import type { KnowledgeGraph } from '../graph/knowledge-graph'
import { ChunkNode, DocumentNode, GraphNode } from '../graph/node'
import type { Transform } from '../types'
import type { Splitter, Document, Chunk } from '@ai-sdk-eval/rag'

/**
 * Type guard to check if a node is a DocumentNode
 */
function isDocumentNode<T extends object>(
  node: GraphNode<T>
): node is DocumentNode<T> {
  return node.type === 'document'
}

/**
 * Convert a DocumentNode to a Document for splitting
 */
function nodeToDocument<T extends object>(node: DocumentNode<T>): Document {
  return {
    id: node.id,
    content: node.content,
    metadata: node.metadata as Record<string, unknown>,
  }
}

/**
 * Chunk the documents in the graph
 *
 * @param splitter - The splitter to use
 */
export function chunk<T extends object>(
  splitter: Splitter
): Transform<T, T & Chunk['metadata']> {
  return {
    name: 'chunk',
    description: 'Chunk the documents in the graph',
    async apply(
      graph: KnowledgeGraph<T>
    ): Promise<KnowledgeGraph<T & Chunk['metadata']>> {
      const nodes = graph.getNodes().filter(isDocumentNode)

      if (nodes.length === 0) {
        return graph as KnowledgeGraph<T & Chunk['metadata']>
      }

      for (const node of nodes) {
        const document = nodeToDocument(node)
        const chunks = splitter.split(document)

        for await (const chunk of chunks) {
          const mergedMetadata: T & Chunk['metadata'] = {
            ...node.metadata,
            ...chunk.metadata,
          } as T & Chunk['metadata']

          graph.addNode(new ChunkNode(chunk.id, chunk.content, mergedMetadata))
          graph.addRelationship(node.id, chunk.id, {
            type: 'hierarchy',
            role: 'parent',
          })
          graph.addRelationship(chunk.id, node.id, {
            type: 'hierarchy',
            role: 'child',
          })
        }
      }

      return graph as KnowledgeGraph<T & Chunk['metadata']>
    },
  }
}
