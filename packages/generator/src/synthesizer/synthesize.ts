import { EvaluationDataset, pLimit } from '@open-evals/core'
import type { KnowledgeGraph } from '../graph/knowledge-graph'
import type { Persona } from '../persona/type'
import { generateScenarios } from '../scenario/scenario-builder'
import type { Scenario } from '../scenario/type'
import type { Synthesizer, SynthesizerConfig } from './type'

const DEFAULT_CONFIG: Required<SynthesizerConfig> = {
  concurrency: 5,
  generateGroundTruth: true,
}

export interface SynthesizeOptions<T extends object = {}> {
  graph: KnowledgeGraph<T>
  synthesizers: [Synthesizer<T>, number][]
  personas: Persona[]
  count: number
  config?: SynthesizerConfig
}

/**
 * Generate synthetic test data from a knowledge graph
 *
 * This function orchestrates the entire test generation process:
 * 1. Generates scenarios based on the knowledge graph and personas
 * 2. Distributes scenarios across different synthesizers
 * 3. Generates questions, contexts, and ground truth answers
 *
 * @param options - The synthesis options
 * @param options.graph - The knowledge graph to generate test data from
 * @param options.synthesizers - Array of [synthesizer, weight] tuples. Weights determine the distribution of samples
 * @param options.personas - The personas to generate test data for
 * @param options.count - The number of test samples to generate
 * @param options.config - Configuration options
 * @returns Array of generated test samples
 *
 * @example
 * ```typescript
 * const synthesizers: [Synthesizer<T>, number][] = [
 *   [createSynthesizer(model, 'single-hop-specific'), 60],  // 60% weight
 *   [createSynthesizer(model, 'multi-hop-abstract'), 20],   // 20% weight
 *   [createSynthesizer(model, 'multi-hop-specific'), 20],   // 20% weight
 * ]
 * const testSamples = await synthesize({
 *   graph,
 *   synthesizers,
 *   personas,
 *   count: 100
 * })
 * ```
 */
export async function synthesize<T extends object = {}>(
  options: SynthesizeOptions<T>
): Promise<EvaluationDataset> {
  const { graph, synthesizers, personas, count, config } = options
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
    count: Math.round((count * weight) / totalWeight),
  }))

  const totalCalculated = samplesPerSynthesizer.reduce(
    (sum, { count: sampleCount }) => sum + sampleCount,
    0
  )
  const difference = count - totalCalculated
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

  return new EvaluationDataset(testSamples)
}
