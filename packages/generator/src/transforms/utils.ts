import type { KnowledgeGraph } from '../graph/knowledge-graph'
import type { Transform } from '../types'

/**
 * Type-safe pipeline builder for knowledge graph transformations
 */
export class Pipeline<T extends object> {
  private transforms: Transform<any, any>[] = []

  constructor(private kg: KnowledgeGraph<T>) {}

  /**
   * Add a transform to the pipeline
   * The output type of the transform becomes the new pipeline type
   */
  pipe<TOutput extends object>(
    transform: Transform<T, TOutput>
  ): Pipeline<TOutput> {
    this.transforms.push(transform)
    return this as unknown as Pipeline<TOutput>
  }

  /**
   * Apply all transforms in the pipeline sequentially
   * Returns the final transformed knowledge graph
   */
  async apply(): Promise<KnowledgeGraph<T>> {
    let result: KnowledgeGraph<any> = this.kg

    for (const transformer of this.transforms) {
      result = await transformer.apply(result)
    }

    return result as KnowledgeGraph<T>
  }
}

/**
 * Create a transform for knowledge graph transformations
 *
 * @param kg - The input knowledge graph
 * @returns A transform builder
 *
 * @example
 * ```ts
 * const result = await transform(kg)
 *   .pipe(chunk(splitter))
 *   .pipe(embed(embedModel))
 *   .apply()
 * ```
 */
export function transform<T extends object>(
  kg: KnowledgeGraph<T>
): Pipeline<T> {
  return new Pipeline(kg)
}
