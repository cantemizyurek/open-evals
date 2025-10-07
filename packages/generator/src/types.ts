import type { KnowledgeGraph } from './graph/knowledge-graph'

export type Relationship =
  | { type: 'similarity'; score: number }
  | { type: 'hierarchy'; role: 'parent' | 'child' }
  | { type: 'entity'; role: 'related' }

export interface Transform<
  TInputMeta extends object,
  TOutputMeta extends object,
  TOptions extends object = {}
> {
  name: string
  description: string
  apply(
    input: KnowledgeGraph<TInputMeta>,
    options?: TOptions
  ): Promise<KnowledgeGraph<TOutputMeta>>
}
