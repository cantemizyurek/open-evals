import type { KnowledgeGraph } from '../graph/knowledge-graph'
import type { Transform } from '../types'

/**
 * Apply a sequence of transforms to a knowledge graph
 *
 * Note: Intermediate transform types cannot be statically verified.
 * Ensure transforms are compatible: output type of transform N
 * must match input type of transform N+1.
 *
 * @param graph - The input knowledge graph
 * @param transformers - Array of transforms to apply in sequence
 * @returns The transformed knowledge graph
 */
export async function transform<TInput extends object, TOutput extends object>(
  graph: KnowledgeGraph<TInput>,
  transformers: Transform<any, any, any>[]
): Promise<KnowledgeGraph<TOutput>> {
  let result: KnowledgeGraph<any> = graph

  for (const transformer of transformers) {
    result = await transformer.apply(result, {})
  }

  return result as KnowledgeGraph<TOutput>
}
