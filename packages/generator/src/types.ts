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
  // Use function property (not method) for strict contravariant checking
  apply: (
    input: KnowledgeGraph<TInputMeta>,
    options?: TOptions
  ) => Promise<KnowledgeGraph<TOutputMeta>>
}
