import { shuffle } from '@ai-sdk-eval/core'
import { KnowledgeGraph } from '../graph/knowledge-graph'
import { ChunkNode } from '../graph/node'
import { Persona } from '../persona/type'
import type { Scenario, QueryLength, QueryStyle } from './type'

export interface ScenarioBuilderConfig {
  /**
   * Number of scenarios to generate per node/node-pair
   * @default 1
   */
  scenariosPerNode?: number

  /**
   * Query lengths to generate scenarios for
   * @default ['short', 'medium', 'long']
   */
  queryLengths?: QueryLength[]

  /**
   * Query styles to generate scenarios for
   * @default ['web-search', 'conversational', 'technical']
   */
  queryStyles?: QueryStyle[]
}

/**
 * Generates scenarios for a given graph, persona, and count
 *
 * @param graph - The graph to generate scenarios for
 * @param persona - The persona to generate scenarios for
 * @param count - The number of scenarios to generate
 * @param type - The type of scenario to generate
 * @param config - The configuration for the scenario builder
 * @returns The generated scenarios
 */
export function generateScenarios<T extends object = {}>(
  graph: KnowledgeGraph<T>,
  persona: Persona,
  count: number,
  type: 'single-hop' | 'multi-hop',
  config: ScenarioBuilderConfig = {}
): Scenario<T>[] {
  return new (type === 'single-hop'
    ? SingleHopScenarioBuilder
    : MultiHopScenarioBuilder)<T>(config).build(graph, persona, count)
}

const DEFAULT_CONFIG: Required<ScenarioBuilderConfig> = {
  scenariosPerNode: 1,
  queryLengths: ['short', 'medium', 'long'],
  queryStyles: ['web-search', 'conversational', 'technical'],
}

export abstract class ScenarioBuilder<T extends object = {}> {
  protected config: Required<ScenarioBuilderConfig>

  constructor(config: ScenarioBuilderConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  abstract build(
    graph: KnowledgeGraph<T>,
    persona: Persona,
    count: number
  ): Scenario<T>[]

  /**
   * Generates query configuration combinations
   */
  protected *generateQueryConfigs(): Generator<
    { length: QueryLength; style: QueryStyle },
    void,
    unknown
  > {
    for (const length of this.config.queryLengths) {
      for (const style of this.config.queryStyles) {
        yield { length, style }
      }
    }
  }

  /**
   * Samples n items from an array using Fisher-Yates shuffle
   */
  protected sample<U>(arr: U[], n: number): U[] {
    if (n >= arr.length) return shuffle(arr)

    return shuffle(arr).slice(0, n)
  }
}

/**
 * Builds single-hop scenarios from individual chunk nodes.
 * Each scenario uses a single node as context.
 */
export class SingleHopScenarioBuilder<
  T extends object = {}
> extends ScenarioBuilder<T> {
  build(
    graph: KnowledgeGraph<T>,
    persona: Persona,
    count: number
  ): Scenario<T>[] {
    const scenarios: Scenario<T>[] = []
    let chunkNodes = shuffle(graph.getNodesByType('chunk'))

    if (chunkNodes.length === 0) {
      return scenarios
    }

    const queryConfigs = Array.from(this.generateQueryConfigs())
    let nodeIndex = 0

    while (scenarios.length < count) {
      const node = chunkNodes[nodeIndex % chunkNodes.length]
      const { length, style } =
        queryConfigs[Math.floor(Math.random() * queryConfigs.length)]

      scenarios.push({
        persona,
        context: {
          nodes: [node],
        },
        query: {
          length,
          style,
          type: 'single-hop',
        },
      })

      nodeIndex++

      if (nodeIndex % chunkNodes.length === 0) {
        chunkNodes = shuffle(chunkNodes)
      }
    }

    return scenarios
  }
}

/**
 * Builds multi-hop scenarios from connected nodes in the graph.
 * Each scenario uses multiple related nodes as context.
 */
export class MultiHopScenarioBuilder<
  T extends object = {}
> extends ScenarioBuilder<T> {
  private minSimilarityScore: number
  private maxHops: number

  constructor(
    config: ScenarioBuilderConfig & {
      /**
       * Minimum similarity score for connected nodes
       * @default 0.5
       */
      minSimilarityScore?: number
      /**
       * Maximum number of hops for multi-hop queries
       * @default 2
       */
      maxHops?: number
    } = {}
  ) {
    super(config)
    this.minSimilarityScore = config.minSimilarityScore ?? 0.5
    this.maxHops = config.maxHops ?? 2
  }

  build(
    graph: KnowledgeGraph<T>,
    persona: Persona,
    count: number
  ): Scenario<T>[] {
    const scenarios: Scenario<T>[] = []
    const chunkNodes = shuffle(graph.getNodesByType('chunk'))

    if (chunkNodes.length === 0) {
      return scenarios
    }

    let connectedGroups = this.findConnectedNodeGroups(graph, chunkNodes)

    if (connectedGroups.length === 0) {
      for (let i = 0; i < chunkNodes.length - 1; i += 2) {
        connectedGroups.push([chunkNodes[i], chunkNodes[i + 1]])
      }
    }

    const queryConfigs = Array.from(this.generateQueryConfigs())
    let groupIndex = 0

    while (scenarios.length < count) {
      const nodes = connectedGroups[groupIndex % connectedGroups.length]
      const { length, style } =
        queryConfigs[Math.floor(Math.random() * queryConfigs.length)]

      scenarios.push({
        persona,
        context: {
          nodes,
        },
        query: {
          length,
          style,
          type: 'multi-hop',
        },
      })

      groupIndex++

      if (groupIndex % connectedGroups.length === 0) {
        connectedGroups = shuffle(connectedGroups)
      }
    }

    return scenarios
  }

  /**
   * Finds groups of connected nodes using BFS traversal
   */
  private findConnectedNodeGroups(
    graph: KnowledgeGraph<T>,
    chunkNodes: ChunkNode<T>[]
  ): ChunkNode<T>[][] {
    const groups: ChunkNode<T>[][] = []
    const visited = new Set<string>()

    for (const startNode of chunkNodes) {
      if (visited.has(startNode.id)) continue

      const group = this.findConnectedNodes(graph, startNode, visited)

      if (group.length >= 2 && group.length <= this.maxHops + 1) {
        groups.push(group)
      }
    }

    return groups
  }

  /**
   * Finds connected nodes using BFS with relationship filtering
   */
  private findConnectedNodes(
    graph: KnowledgeGraph<T>,
    startNode: ChunkNode<T>,
    visited: Set<string>
  ): ChunkNode<T>[] {
    const nodes: ChunkNode<T>[] = [startNode]
    const queue: [ChunkNode<T>, number][] = [[startNode, 0]]
    visited.add(startNode.id)

    while (queue.length > 0) {
      const [currentNode, depth] = queue.shift()!

      if (depth >= this.maxHops) continue

      for (const [neighborId, relationship] of currentNode.relationships) {
        if (visited.has(neighborId)) continue

        const isQualified =
          relationship.type === 'hierarchy' ||
          (relationship.type === 'similarity' &&
            relationship.score >= this.minSimilarityScore)

        if (!isQualified) continue

        const neighbor = graph.getNode(neighborId)
        if (neighbor && neighbor.type === 'chunk') {
          nodes.push(neighbor as ChunkNode<T>)
          queue.push([neighbor as ChunkNode<T>, depth + 1])
          visited.add(neighborId)
        }
      }
    }

    return nodes
  }
}
