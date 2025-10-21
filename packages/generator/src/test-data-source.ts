import type { EvaluationSample, TestDataSource, TestDataGenerationConfig } from '@open-evals/core'
import type { KnowledgeGraph } from './graph/knowledge-graph'
import type { Persona } from './persona/type'
import type { Synthesizer, SynthesizerType } from './synthesizer/type'
import type { LLM } from './types'
import { synthesize, type SynthesizeConfig } from './synthesizer/synthesize'
import { createSynthesizer } from './synthesizer/implementations'
import { generatePersonas } from './persona/generate-persona'

/**
 * Configuration for creating an SDG test data source
 */
export interface SDGSourceConfig<T extends object = object> {
  /** Knowledge graph to use for generation */
  knowledgeGraph: KnowledgeGraph<T>

  /** LLM instance for generation */
  llm: LLM

  /** Synthesizer configurations with counts */
  synthesizers?: Array<[SynthesizerType, number]>

  /** Pre-generated personas (optional, will generate if not provided) */
  personas?: Persona[]

  /** Number of personas to generate if not provided */
  personaCount?: number

  /** Whether to generate ground truth answers */
  generateGroundTruth?: boolean

  /** Source name */
  name?: string

  /** Custom synthesizer instances */
  customSynthesizers?: Array<[Synthesizer, number]>
}

/**
 * Create a test data source using Synthetic Data Generation (SDG)
 *
 * This source integrates with the generator package's SDG pipeline,
 * using Knowledge Graphs, Personas, Scenarios, and Synthesizers to
 * create diverse, realistic evaluation samples.
 *
 * @example
 * ```typescript
 * const knowledgeGraph = await transform(graph(documents))
 *   .pipe(chunk(splitter))
 *   .pipe(embed(embedModel))
 *   .pipe(relationship())
 *   .apply()
 *
 * const sdgSource = createSDGSource({
 *   knowledgeGraph,
 *   llm: myLLM,
 *   synthesizers: [
 *     ['single-hop-specific', 30],
 *     ['multi-hop-abstract', 20]
 *   ],
 *   personaCount: 5,
 *   generateGroundTruth: true
 * })
 *
 * const generator = new TestDataGenerator().from(sdgSource)
 * const dataset = await generator.generateDataset({ count: 50 })
 * ```
 */
export function createSDGSource<T extends object = object>(
  config: SDGSourceConfig<T>
): TestDataSource {
  let cachedPersonas: Persona[] | null = null

  return {
    name: config.name ?? 'sdg',
    description: 'Synthetic Data Generation using Knowledge Graphs and LLMs',

    async generate(genConfig: TestDataGenerationConfig): Promise<EvaluationSample[]> {
      // Generate or use cached personas
      if (!cachedPersonas) {
        cachedPersonas =
          config.personas ??
          (await generatePersonas(config.knowledgeGraph, config.llm, {
            count: config.personaCount ?? 5,
          }))
      }

      // Prepare synthesizers
      const synthesizers: Array<[Synthesizer, number]> = []

      // Add custom synthesizers if provided
      if (config.customSynthesizers) {
        synthesizers.push(...config.customSynthesizers)
      }

      // Create synthesizers from types
      if (config.synthesizers) {
        for (const [type, count] of config.synthesizers) {
          const synthesizer = createSynthesizer(config.llm, type)
          synthesizers.push([synthesizer, count])
        }
      }

      // If no synthesizers configured, use default
      if (synthesizers.length === 0) {
        const defaultSynthesizer = createSynthesizer(config.llm, 'single-hop-specific')
        synthesizers.push([defaultSynthesizer, 100])
      }

      // Configure synthesis
      const synthesizeConfig: SynthesizeConfig<T> = {
        graph: config.knowledgeGraph,
        synthesizers,
        personas: cachedPersonas,
        count: genConfig.count,
        config: {
          generateGroundTruth: config.generateGroundTruth ?? true,
        },
      }

      // Generate dataset
      const dataset = await synthesize(synthesizeConfig)

      // Return samples
      return dataset.toArray()
    },

    async validate(genConfig: TestDataGenerationConfig): Promise<void> {
      if (genConfig.count <= 0) {
        throw new Error('Count must be greater than 0')
      }

      const nodes = config.knowledgeGraph.getNodes()
      if (nodes.length === 0) {
        throw new Error('Knowledge graph is empty')
      }
    },

    async estimateCost(genConfig: TestDataGenerationConfig): Promise<number> {
      // Rough estimation:
      // - Persona generation: ~1000 tokens per persona
      // - Question generation: ~500 tokens per sample
      // - Ground truth generation: ~300 tokens per sample if enabled

      let totalTokens = 0

      // Persona cost (if not cached)
      if (!cachedPersonas && !config.personas) {
        const personaCount = config.personaCount ?? 5
        totalTokens += personaCount * 1000
      }

      // Sample generation cost
      totalTokens += genConfig.count * 500

      // Ground truth cost
      if (config.generateGroundTruth) {
        totalTokens += genConfig.count * 300
      }

      return totalTokens
    },
  }
}

/**
 * Quick helper to create an SDG source with default settings
 *
 * @example
 * ```typescript
 * const source = createQuickSDGSource(knowledgeGraph, llm)
 * ```
 */
export function createQuickSDGSource<T extends object = object>(
  knowledgeGraph: KnowledgeGraph<T>,
  llm: LLM,
  options: {
    personaCount?: number
    generateGroundTruth?: boolean
    name?: string
  } = {}
): TestDataSource {
  return createSDGSource({
    knowledgeGraph,
    llm,
    synthesizers: [['single-hop-specific', 100]],
    personaCount: options.personaCount ?? 3,
    generateGroundTruth: options.generateGroundTruth ?? true,
    name: options.name,
  })
}

/**
 * Create an SDG source with mixed synthesizer types for diversity
 *
 * @example
 * ```typescript
 * const source = createDiverseSDGSource(knowledgeGraph, llm, {
 *   singleHop: 40,
 *   multiHopAbstract: 30,
 *   multiHopSpecific: 30
 * })
 * ```
 */
export function createDiverseSDGSource<T extends object = object>(
  knowledgeGraph: KnowledgeGraph<T>,
  llm: LLM,
  distribution: {
    singleHop?: number
    multiHopAbstract?: number
    multiHopSpecific?: number
  },
  options: {
    personaCount?: number
    generateGroundTruth?: boolean
    name?: string
  } = {}
): TestDataSource {
  const synthesizers: Array<[SynthesizerType, number]> = []

  if (distribution.singleHop) {
    synthesizers.push(['single-hop-specific', distribution.singleHop])
  }
  if (distribution.multiHopAbstract) {
    synthesizers.push(['multi-hop-abstract', distribution.multiHopAbstract])
  }
  if (distribution.multiHopSpecific) {
    synthesizers.push(['multi-hop-specific', distribution.multiHopSpecific])
  }

  return createSDGSource({
    knowledgeGraph,
    llm,
    synthesizers,
    personaCount: options.personaCount ?? 5,
    generateGroundTruth: options.generateGroundTruth ?? true,
    name: options.name ?? 'diverse-sdg',
  })
}
