import { z } from 'zod'
import type { Relationship } from '../types'

const relationshipSchema = z.tuple([
  z.string(),
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('similarity'),
      score: z.number(),
    }),
    z.object({
      type: z.literal('hierarchy'),
      role: z.enum(['parent', 'child']),
    }),
    z.object({
      type: z.literal('entity'),
      role: z.enum(['related']),
    }),
  ]),
])

const baseNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['document', 'chunk']),
  metadata: z.unknown(),
  relationships: z.array(relationshipSchema).optional(),
})

const documentNodeSchema = baseNodeSchema.extend({
  type: z.literal('document'),
  content: z.string(),
})

const chunkNodeSchema = baseNodeSchema.extend({
  type: z.literal('chunk'),
  content: z.string(),
})

export abstract class GraphNode<T = unknown> {
  id: string
  type: 'document' | 'chunk'
  metadata: T
  relationships: Map<string, Relationship>

  constructor(id: string, type: 'document' | 'chunk', metadata: T) {
    this.id = id
    this.type = type
    this.metadata = metadata
    this.relationships = new Map<string, Relationship>()
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      metadata: this.metadata,
      relationships: Array.from(this.relationships.entries()),
    }
  }

  static fromJSON<T>(_json: Record<string, unknown>): GraphNode<T> {
    throw new Error('Method not implemented.')
  }
}

export class DocumentNode<T = unknown> extends GraphNode<T> {
  public content: string

  constructor(id: string, content: string, metadata: T) {
    super(id, 'document', metadata)
    this.content = content
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      content: this.content,
    }
  }

  static fromJSON<T>(json: Record<string, unknown>): GraphNode<T> {
    const validated = documentNodeSchema.parse(json)
    const node = new DocumentNode(
      validated.id,
      validated.content,
      validated.metadata as T
    )
    if (validated.relationships) {
      node.relationships = new Map(
        validated.relationships as [string, Relationship][]
      )
    }
    return node
  }
}

export class ChunkNode<T = unknown> extends GraphNode<T> {
  public content: string

  constructor(id: string, content: string, metadata: T) {
    super(id, 'chunk', metadata)
    this.content = content
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      content: this.content,
    }
  }

  static fromJSON<T>(json: Record<string, unknown>): GraphNode<T> {
    const validated = chunkNodeSchema.parse(json)
    const node = new ChunkNode(
      validated.id,
      validated.content,
      validated.metadata as T
    )
    if (validated.relationships) {
      node.relationships = new Map(
        validated.relationships as [string, Relationship][]
      )
    }
    return node
  }
}
