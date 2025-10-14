import { pLimit, type SingleTurnSample } from '@ai-sdk-eval/core'
import type { KnowledgeGraph } from '../graph/knowledge-graph'
import type { Persona } from '../persona/type'
import { generateScenarios } from '../scenario/scenario-builder'
import type { Scenario } from '../scenario/type'
import type { Synthesizer, SynthesizerConfig } from './type'

const DEFAULT_CONFIG: Required<SynthesizerConfig> = {
  concurrency: 5,
  generateGroundTruth: true,
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
 * @param synthesizers - Array of [synthesizer, weight] tuples. Weights determine the distribution of samples
 * @param personas - The personas to generate test data for
 * @param numSamples - The number of test samples to generate
 * @param config - Configuration options
 * @returns Array of generated test samples
 *
 * @example
 * ```typescript
 * const synthesizers: [Synthesizer<T>, number][] = [
 *   [createSynthesizer(model, 'single-hop-specific'), 60],  // 60% weight
 *   [createSynthesizer(model, 'multi-hop-abstract'), 20],   // 20% weight
 *   [createSynthesizer(model, 'multi-hop-specific'), 20],   // 20% weight
 * ]
 * const testSamples = await synthesize(
 *   graph,
 *   synthesizers,
 *   personas,
 *   100
 * )
 * ```
 */
export async function synthesize<T extends object = {}>(
  graph: KnowledgeGraph<T>,
  synthesizers: [Synthesizer<T>, number][],
  personas: Persona[],
  numSamples: number,
  config?: SynthesizerConfig
): Promise<SingleTurnSample[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  if (synthesizers.length === 0) {
    throw new Error('At least one synthesizer must be provided')
  }

  if (personas.length === 0) {
    throw new Error('At least one persona must be provided')
  }

  const totalWeight = synthesizers.reduce((sum, [, weight]) => sum + weight, 0)
  if (totalWeight === 0) {
    throw new Error('Total weight of synthesizers must be greater than 0')
  }

  const samplesPerSynthesizer = synthesizers.map(([synthesizer, weight]) => ({
    synthesizer,
    count: Math.round((numSamples * weight) / totalWeight),
  }))

  const totalCalculated = samplesPerSynthesizer.reduce(
    (sum, { count }) => sum + count,
    0
  )
  const difference = numSamples - totalCalculated
  if (difference !== 0) {
    const largestIndex = samplesPerSynthesizer.reduce(
      (maxIdx, curr, idx, arr) =>
        curr.count > arr[maxIdx]!.count ? idx : maxIdx,
      0
    )
    samplesPerSynthesizer[largestIndex]!.count += difference
  }

  const scenariosWithSynthesizers: Array<{
    scenario: Scenario<T>
    synthesizer: Synthesizer<T>
  }> = []

  for (const { synthesizer, count } of samplesPerSynthesizer) {
    if (count <= 0) continue

    const scenarioType = synthesizer.type

    const scenariosPerPersona = Math.floor(count / personas.length)
    const personaRemainder = count % personas.length

    personas.forEach((persona, index) => {
      const personaCount =
        scenariosPerPersona + (index < personaRemainder ? 1 : 0)

      if (personaCount > 0) {
        const scenariosForPersona = generateScenarios(
          graph,
          persona,
          personaCount,
          scenarioType
        )

        scenariosForPersona.forEach((scenario) => {
          scenariosWithSynthesizers.push({
            scenario,
            synthesizer,
          })
        })
      }
    })
  }

  const testSamples = await pLimit(
    scenariosWithSynthesizers,
    async ({ scenario, synthesizer }) => {
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
