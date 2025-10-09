import type { LanguageModel } from 'ai'
import { pLimit, type SingleTurnSample } from '@ai-sdk-eval/core'
import type { KnowledgeGraph } from '../graph/knowledge-graph'
import type { Persona } from '../persona/type'
import { generateScenarios } from '../scenario/scenario-builder'
import type { Scenario } from '../scenario/type'
import type { SynthesizerConfig } from './type'
import { createSynthesizers } from './implementations'

const DEFAULT_DISTRIBUTION = {
  'single-hop-specific': 50,
  'multi-hop-abstract': 25,
  'multi-hop-specific': 25,
}

const DEFAULT_CONFIG: Required<SynthesizerConfig> = {
  concurrency: 5,
  generateGroundTruth: true,
  distribution: DEFAULT_DISTRIBUTION,
}

/**
 * Generate synthetic test data from a knowledge graph
 *
 * This function orchestrates the entire test generation process:
 * 1. Generates scenarios based on the knowledge graph and personas
 * 2. Distributes scenarios across different synthesizers
 * 3. Generates questions, contexts, and ground truth answers
 *
 * @param graph - The knowledge graph to generate test data from
 * @param model - The language model to use for generation
 * @param personas - The personas to generate test data for
 * @param numSamples - The number of test samples to generate
 * @param config - Configuration options
 * @returns Array of generated test samples
 *
 * @example
 * ```typescript
 * const testSamples = await synthesize(
 *   graph,
 *   openai.chat('gpt-4'),
 *   personas,
 *   100,
 *   {
 *     distribution: {
 *       'single-hop-specific': 60,
 *       'multi-hop-abstract': 20,
 *       'multi-hop-specific': 20,
 *     }
 *   }
 * )
 * ```
 */
export async function synthesize<T extends object = {}>(
  graph: KnowledgeGraph<T>,
  model: LanguageModel,
  personas: Persona[],
  numSamples: number,
  config?: SynthesizerConfig
): Promise<SingleTurnSample[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const distribution = { ...DEFAULT_DISTRIBUTION, ...finalConfig.distribution }

  const totalWeight = Object.values(distribution).reduce(
    (sum, weight) => sum + weight,
    0
  )
  if (totalWeight === 0) {
    throw new Error('Distribution weights must sum to a positive number')
  }

  const samplesPerType = {
    'single-hop-specific': Math.round(
      (numSamples * distribution['single-hop-specific']!) / totalWeight
    ),
    'multi-hop-abstract': Math.round(
      (numSamples * distribution['multi-hop-abstract']!) / totalWeight
    ),
    'multi-hop-specific': Math.round(
      (numSamples * distribution['multi-hop-specific']!) / totalWeight
    ),
  }

  const totalCalculated = Object.values(samplesPerType).reduce(
    (sum, count) => sum + count,
    0
  )
  samplesPerType['single-hop-specific'] += numSamples - totalCalculated

  // Track scenarios with their synthesizer types
  const scenariosWithTypes: Array<{
    scenario: Scenario<T>
    synthesizerType: keyof typeof samplesPerType
  }> = []

  for (const [type, count] of Object.entries(samplesPerType)) {
    if (count <= 0) continue

    const scenarioType = type.startsWith('single-hop')
      ? 'single-hop'
      : 'multi-hop'

    const scenariosPerPersona = Math.floor(count / personas.length)
    const remainder = count % personas.length

    personas.forEach((persona, index) => {
      const personaCount = scenariosPerPersona + (index < remainder ? 1 : 0)

      if (personaCount > 0) {
        const scenariosForPersona = generateScenarios(
          graph,
          persona,
          personaCount,
          scenarioType
        )

        scenariosForPersona.forEach((scenario) => {
          scenariosWithTypes.push({
            scenario,
            synthesizerType: type as keyof typeof samplesPerType,
          })
        })
      }
    })
  }

  const synthesizers = createSynthesizers<T>(model)

  const testSamples = await pLimit(
    scenariosWithTypes,
    async ({ scenario, synthesizerType }) => {
      const synthesizer = synthesizers[synthesizerType]

      const sample = await synthesizer.generate(scenario)

      if (!finalConfig.generateGroundTruth) {
        delete sample.reference
      }

      return sample
    },
    finalConfig.concurrency
  )

  return testSamples
}
