import type { Relationship } from '../types'
import { ChunkNode, DocumentNode, GraphNode } from './node'

export function graph<T extends object = {}>(
  nodes?: GraphNode<T>[]
): KnowledgeGraph<T> {
  const graph = new KnowledgeGraph<T>()
  for (const node of nodes || []) {
    graph.addNode(node)
  }
  return graph
}

export class KnowledgeGraph<T extends object = {}> {
  private nodes: Map<string, GraphNode<T>> = new Map()

  addNode(node: GraphNode<T>): void {
    this.nodes.set(node.id, node)
  }

  removeNode(id: string): void {
    this.nodes.delete(id)

    for (const node of this.nodes.values()) {
      node.relationships.delete(id)
    }
  }

  addRelationship(
    sourceId: string,
    targetId: string,
    relationship: Relationship
  ): void {
    const sourceNode = this.nodes.get(sourceId)
    if (!sourceNode) {
      throw new Error(`Source node ${sourceId} not found`)
    }
    const targetNode = this.nodes.get(targetId)
    if (!targetNode) {
      throw new Error(`Target node ${targetId} not found`)
    }

    sourceNode.relationships.set(targetId, relationship)
  }

  removeRelationship(sourceId: string, targetId: string): void {
    const sourceNode = this.nodes.get(sourceId)
    if (!sourceNode) {
      throw new Error(`Source node ${sourceId} not found`)
    }
    sourceNode.relationships.delete(targetId)
  }

  getRelationships(id: string): Relationship[] {
    const sourceNode = this.nodes.get(id)
    if (!sourceNode) {
      throw new Error(`Source node ${id} not found`)
    }

    return Array.from(sourceNode.relationships.values())
  }

  getNeighbors(id: string, type?: Relationship['type']): GraphNode<T>[] {
    const node = this.getNode(id)
    if (!node) {
      throw new Error(`Source node ${id} not found`)
    }

    const neighbors: GraphNode<T>[] = []

    for (const [neighborId, relationship] of node.relationships) {
      if (type && relationship.type !== type) {
        continue
      }

      const neighbor = this.nodes.get(neighborId)
      if (neighbor) neighbors.push(neighbor)
    }

    return neighbors
  }

  getNodesByType<K extends GraphNode<T>['type']>(
    type: K
  ): K extends 'document'
    ? DocumentNode<T>[]
    : K extends 'chunk'
    ? ChunkNode<T>[]
    : never {
    if (type === 'document') {
      return Array.from(this.nodes.values()).filter(
        (node) => node.type === 'document'
      ) as K extends 'document'
        ? DocumentNode<T>[]
        : K extends 'chunk'
        ? ChunkNode<T>[]
        : never
    } else if (type === 'chunk') {
      return Array.from(this.nodes.values()).filter(
        (node) => node.type === 'chunk'
      ) as K extends 'document'
        ? DocumentNode<T>[]
        : K extends 'chunk'
        ? ChunkNode<T>[]
        : never
    } else {
      throw new Error(`Invalid node type: ${type}`)
    }
  }

  getNodesBy(callback: (node: GraphNode<T>) => boolean): GraphNode<T>[] {
    return Array.from(this.nodes.values()).filter(callback)
  }

  getNodes(): GraphNode<T>[] {
    return Array.from(this.nodes.values())
  }

  getNode(id: string): GraphNode<T> | undefined {
    return this.nodes.get(id)
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id)
  }

  *traverse(id: string, maxDepth: number = Infinity): Generator<GraphNode<T>> {
    const visited = new Set<string>()
    const queue: [string, number][] = [[id, 0]]

    visited.add(id)

    while (queue.length > 0) {
      const [currentId, depth] = queue.shift()!
      const node = this.getNode(currentId)
      if (!node) {
        continue
      }
      yield node
      if (depth < maxDepth) {
        for (const neighbor of this.getNeighbors(currentId)) {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id)
            queue.push([neighbor.id, depth + 1])
          }
        }
      }
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      nodes: Array.from(this.nodes.values()).map((node) => node.toJSON()),
    }
  }

  static fromJSON<T extends object = {}>(
    json: Record<string, unknown>
  ): KnowledgeGraph<T> {
    const graph = new KnowledgeGraph<T>()

    if (json.nodes && Array.isArray(json.nodes)) {
      for (const nodeData of json.nodes) {
        if (typeof nodeData === 'object' && nodeData !== null) {
          if (nodeData.type === 'document') {
            graph.addNode(DocumentNode.fromJSON(nodeData))
          } else if (nodeData.type === 'chunk') {
            graph.addNode(ChunkNode.fromJSON(nodeData))
          }
        }
      }
    }

    return graph
  }
}
