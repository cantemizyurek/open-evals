import type { EmbeddingModel } from 'ai'
import { embedMany } from 'ai'
import type { Transform } from '../types'
import type { KnowledgeGraph } from '../graph/knowledge-graph'
import type { Embedding } from './embed'
import type { GraphNode } from '../graph/node'

/**
 * Embed a property from node metadata in the graph
 * Similar to Ragas' EmbeddingExtractor
 *
 * @param model - The embedding model to use
 * @param config - Configuration for which property to embed and where to store it
 */
export function embedProperty<
  TProperty extends string,
  const TConfig extends {
    embedProperty: TProperty
    propertyName: string
    filter?: <T>(node: GraphNode<T>) => boolean
  }
>(
  model: EmbeddingModel,
  config: TConfig
): Transform<
  { [K in TProperty]?: string },
  { [K in TProperty]?: string } & { [K in TConfig['propertyName']]?: Embedding }
> {
  const { embedProperty, propertyName, filter } = config

  return {
    name: 'embedProperty',
    description: `Embed ${embedProperty} property in nodes`,
    apply: async (
      graph: KnowledgeGraph<{ [K in TProperty]?: string }>
    ): Promise<
      KnowledgeGraph<
        { [K in TProperty]?: string } & {
          [K in TConfig['propertyName']]?: Embedding
        }
      >
    > => {
      const allNodes = graph.getNodes()

      if (allNodes.length === 0) {
        return graph as KnowledgeGraph<
          { [K in TProperty]?: string } & {
            [K in TConfig['propertyName']]?: Embedding
          }
        >
      }

      const filteredNodes = filter ? allNodes.filter(filter) : allNodes

      const nodesWithProperty = filteredNodes.filter((node) => {
        const metadata = node.metadata as Record<string, unknown>
        const value = metadata?.[embedProperty]
        return typeof value === 'string' && value.trim().length > 0
      })

      if (nodesWithProperty.length === 0) {
        return graph as KnowledgeGraph<
          { [K in TProperty]?: string } & {
            [K in TConfig['propertyName']]?: Embedding
          }
        >
      }

      const values = nodesWithProperty.map((node) => {
        const metadata = node.metadata as Record<string, string>
        return metadata[embedProperty]
      })

      const { embeddings } = await embedMany({
        model,
        values,
      })

      for (let i = 0; i < nodesWithProperty.length; i++) {
        nodesWithProperty[i].metadata = {
          ...nodesWithProperty[i].metadata,
          [propertyName]: embeddings[i],
        } as { [K in TProperty]?: string } & {
          [K in TConfig['propertyName']]?: Embedding
        }
      }

      return graph as KnowledgeGraph<
        { [K in TProperty]?: string } & {
          [K in TConfig['propertyName']]?: Embedding
        }
      >
    },
  }
}
