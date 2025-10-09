import type { GraphNode } from '../graph/node'
import type { Persona } from '../persona/type'

export type QueryLength = 'short' | 'medium' | 'long'
export type QueryStyle = 'web-search' | 'conversational' | 'technical'
export type QueryType = 'single-hop' | 'multi-hop'

export interface Scenario<T extends object = {}> {
  persona: Persona
  context: {
    nodes: GraphNode<T>[]
  }
  query: {
    length: QueryLength
    style: QueryStyle
    type: QueryType
  }
}
