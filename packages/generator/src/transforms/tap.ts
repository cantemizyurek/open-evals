import { Transform } from '../types'
import { KnowledgeGraph } from '../graph/knowledge-graph'

/**
 * Used for inspecting intermediate results or debugging the pipeline
 *
 * @param callback - The callback to use
 */
export function tap<T extends object>(
  callback: (graph: KnowledgeGraph<T>) => void | Promise<void>
): Transform<T, T> {
  return {
    name: 'tap',
    description:
      'Used for inspecting intermediate results or debugging the pipeline',
    async apply(graph: KnowledgeGraph<T>): Promise<KnowledgeGraph<T>> {
      await callback(graph)
      return graph
    },
  }
}
