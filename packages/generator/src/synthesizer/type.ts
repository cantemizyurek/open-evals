import type { SingleTurnSample } from '@ai-sdk-eval/core'
import type { Scenario } from '../scenario/type'

/**
 * Configuration for synthesizer execution
 */
export interface SynthesizerConfig {
  /**
   * Maximum number of concurrent LLM calls
   * @default 5
   */
  concurrency?: number

  /**
   * Whether to generate ground truth answers
   * @default true
   */
  generateGroundTruth?: boolean

  /**
   * Distribution of synthesizers to use (weights)
   * Weights are relative ratios (do not need to sum to 100).
   * The system normalizes them to determine the probability of selecting each synthesizer type.
   * @default { 'single-hop-specific': 50, 'multi-hop-abstract': 25, 'multi-hop-specific': 25 }
   */
  distribution?: {
    'single-hop-specific'?: number
    'multi-hop-abstract'?: number
    'multi-hop-specific'?: number
  }
}

/**
 * Base interface for all synthesizers
 */
export interface Synthesizer<T extends object = {}> {
  /**
   * The name of the synthesizer
   */
  name: string

  /**
   * The type of queries this synthesizer generates
   */
  type: 'single-hop' | 'multi-hop'

  /**
   * Generate a test sample from a scenario
   */
  generate(scenario: Scenario<T>): Promise<SingleTurnSample>
}
