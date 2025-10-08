import type { LanguageModel } from 'ai'
import { generateText } from 'ai'
import type { Transform } from '../types'
import type { KnowledgeGraph } from '../graph/knowledge-graph'
import { pLimit } from '@ai-sdk-eval/core'
import { DocumentNode, GraphNode } from '../graph/node'

/**
 * Summarize the nodes in the graph
 *
 * @param model - The language model to use for summarization
 */
export function summarize<T extends object>(
  model: LanguageModel,
  config?: {
    concurrency?: number
    filter?: <T>(node: GraphNode<T>) => boolean
  }
): Transform<T, T & { summary?: string }> {
  const { concurrency = 10 } = config || {}

  return {
    name: 'summarize',
    description: 'Generate summaries for nodes in the graph',
    async apply(
      graph: KnowledgeGraph<T>
    ): Promise<KnowledgeGraph<T & { summary?: string }>> {
      const nodes = graph.getNodes().filter(config?.filter || (() => true))

      if (nodes.length === 0) {
        return graph as KnowledgeGraph<T & { summary?: string }>
      }

      const summaryPromises = await pLimit(
        nodes,
        async (node) => {
          const content =
            'content' in node ? (node as DocumentNode).content : ''

          if (!content.trim()) {
            return { node, summary: '' }
          }

          try {
            const result = await generateText({
              model,
              prompt: `
Summarize the following content concisely. Focus on the main topics, key concepts, and primary purpose of the content.

Content:
${content}

Provide a concise summary (2-4 sentences):`.trim(),
            })

            return { node, summary: result.text }
          } catch (error) {
            console.error(
              `Failed to generate summary for node ${node.id}:`,
              error
            )
            return { node, summary: '' }
          }
        },
        concurrency
      )

      for (const { node, summary } of summaryPromises) {
        node.metadata = {
          ...node.metadata,
          summary,
        } as T & { summary?: string }
      }

      return graph as KnowledgeGraph<T & { summary?: string }>
    },
  }
}
