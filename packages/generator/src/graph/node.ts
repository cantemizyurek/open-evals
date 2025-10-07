import type { Relationship } from '../types'

export abstract class GraphNode<T = unknown> {
  id: string
  type: 'document' | 'chunk'
  content: string
  metadata: T
  relationships: Map<string, Relationship>

  constructor(
    id: string,
    type: 'document' | 'chunk',
    content: string,
    metadata: T
  ) {
    this.id = id
    this.type = type
    this.content = content
    this.metadata = metadata
    this.relationships = new Map<string, Relationship>()
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      content: this.content,
      metadata: this.metadata,
      relationships: Array.from(this.relationships.entries()),
    }
  }

  static fromJSON<T>(json: Record<string, unknown>): GraphNode<T> {
    let node: GraphNode<T>

    if (json.type === 'document') {
      node = new DocumentNode(
        json.id as string,
        json.content as string,
        json.metadata as unknown as T
      )
    } else if (json.type === 'chunk') {
      node = new ChunkNode(
        json.id as string,
        json.content as string,
        json.metadata as unknown as T
      )
    } else {
      throw new Error(`Invalid node type: ${json.type}`)
    }

    // Restore relationships
    if (Array.isArray(json.relationships)) {
      node.relationships = new Map(json.relationships as [string, Relationship][])
    }

    return node
  }
}

export class DocumentNode<T = unknown> extends GraphNode<T> {
  constructor(id: string, content: string, metadata: T) {
    super(id, 'document', content, metadata)
  }
}

export class ChunkNode<T = unknown> extends GraphNode<T> {
  constructor(id: string, content: string, metadata: T) {
    super(id, 'chunk', content, metadata)
  }
}
