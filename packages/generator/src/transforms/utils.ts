import type { KnowledgeGraph } from '../graph/knowledge-graph'
import type { Transform } from '../types'

export function composeTransforms<
  TInput extends object,
  TOutput extends object
>(transforms: Transform<any, any, any>[]): Transform<TInput, TOutput> {
  return {
    name: `composed-${transforms.map((t) => t.name).join('-')}`,
    description: `Composed transform of ${transforms
      .map((t) => t.name)
      .join(', ')}`,
    async apply(
      graph: KnowledgeGraph<TInput>,
      options?: {}
    ): Promise<KnowledgeGraph<TOutput>> {
      let result: KnowledgeGraph<any> = graph

      for (const transform of transforms) {
        result = await transform.apply(result, options)
      }

      return result
    },
  }
}
