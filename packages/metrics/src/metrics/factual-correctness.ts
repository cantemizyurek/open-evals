import { LLMMetric, SingleTurnSample, MetricScore } from '@ai-sdk-eval/core'
import type { LanguageModel } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod'
import { fbetaScore } from '../utils'

/**
 * Schema for claim decomposition output
 */
const ClaimDecompositionOutputSchema = z.object({
  claims: z.array(z.string()).describe('Decomposed claims'),
})

/**
 * Schema for a single faithfulness verdict (reused from faithfulness metric)
 */
const StatementFaithfulnessAnswerSchema = z.object({
  statement: z.string().describe('the original statement, word-by-word'),
  reason: z.string().describe('the reason of the verdict'),
  verdict: z
    .number()
    .int()
    .min(0)
    .max(1)
    .describe('the verdict (0/1) of the faithfulness'),
})

/**
 * Schema for NLI statement output
 */
const NLIStatementOutputSchema = z.object({
  statements: z.array(StatementFaithfulnessAnswerSchema),
})

/**
 * Decomposition type for claim decomposition
 */
type DecompositionType =
  | 'low_atomicity_low_coverage'
  | 'low_atomicity_high_coverage'
  | 'high_atomicity_low_coverage'
  | 'high_atomicity_high_coverage'

/**
 * Options for configuring the FactualCorrectness metric
 */
export interface FactualCorrectnessOptions {
  /** The language model to use for evaluation */
  model: LanguageModel
  /** The mode of evaluation: precision, recall, or f1 (default: f1) */
  mode?: 'precision' | 'recall' | 'f1'
  /** Beta value for F-beta score (default: 1.0). Beta > 1 gives more weight to recall, beta < 1 favors precision */
  beta?: number
  /** Level of atomicity for claim decomposition (default: low) */
  atomicity?: 'low' | 'high'
  /** Level of coverage for claim decomposition (default: low) */
  coverage?: 'low' | 'high'
}

/**
 * FactualCorrectness metric evaluates the factual correctness of responses
 * by comparing claims in the response against a reference answer.
 *
 * The metric works by:
 * 1. Decomposing both response and reference into atomic claims
 * 2. Verifying claims using natural language inference (NLI)
 * 3. Computing precision, recall, or F1 score based on verification results
 *
 * This metric requires:
 * - query: The user's question
 * - response: The model's answer
 * - reference: The ground truth/reference answer
 *
 * Score ranges from 0 to 1, where 1 means perfect factual correctness.
 */
export class FactualCorrectness extends LLMMetric<'factual_correctness'> {
  private model: LanguageModel
  private mode: 'precision' | 'recall' | 'f1'
  private beta: number
  private atomicity: 'low' | 'high'
  private coverage: 'low' | 'high'
  private decompositionType: DecompositionType

  constructor(options: FactualCorrectnessOptions) {
    super({
      name: 'factual_correctness',
      description:
        'Evaluates the factual correctness of responses against reference answers',
    })
    this.model = options.model
    this.mode = options.mode ?? 'f1'
    this.beta = options.beta ?? 1.0
    this.atomicity = options.atomicity ?? 'low'
    this.coverage = options.coverage ?? 'low'

    if (typeof this.beta !== 'number') {
      throw new Error(
        'Beta must be a number. A beta > 1 gives more weight to recall, while beta < 1 favors precision.'
      )
    }

    this.decompositionType =
      `${this.atomicity}_atomicity_${this.coverage}_coverage` as DecompositionType
  }

  /**
   * Get examples for claim decomposition based on decomposition type
   */
  private getClaimDecompositionExamples(): string {
    const example1 =
      'Charles Babbage was a French mathematician, philosopher, and food critic.'
    const example2 =
      'Albert Einstein was a German theoretical physicist. He developed the theory of relativity and also contributed to the development of quantum mechanics.'

    const examples: Record<DecompositionType, string> = {
      low_atomicity_low_coverage: `Example 1:
Input: "${example1}"
Output: {
  "claims": ["Charles Babbage was a mathematician and philosopher."]
}

Example 2:
Input: "${example2}"
Output: {
  "claims": [
    "Albert Einstein was a German physicist.",
    "Albert Einstein developed relativity and contributed to quantum mechanics."
  ]
}`,

      low_atomicity_high_coverage: `Example 1:
Input: "${example1}"
Output: {
  "claims": ["${example1}"]
}

Example 2:
Input: "${example2}"
Output: {
  "claims": [
    "Albert Einstein was a German theoretical physicist.",
    "Albert Einstein developed the theory of relativity and also contributed to the development of quantum mechanics."
  ]
}`,

      high_atomicity_low_coverage: `Example 1:
Input: "${example1}"
Output: {
  "claims": [
    "Charles Babbage was a mathematician.",
    "Charles Babbage was a philosopher."
  ]
}

Example 2:
Input: "${example2}"
Output: {
  "claims": [
    "Albert Einstein was a German theoretical physicist.",
    "Albert Einstein developed the theory of relativity."
  ]
}`,

      high_atomicity_high_coverage: `Example 1:
Input: "${example1}"
Output: {
  "claims": [
    "Charles Babbage was a mathematician.",
    "Charles Babbage was a philosopher.",
    "Charles Babbage was a food critic.",
    "Charles Babbage was French."
  ]
}

Example 2:
Input: "${example2}"
Output: {
  "claims": [
    "Albert Einstein was a German theoretical physicist.",
    "Albert Einstein developed the theory of relativity.",
    "Albert Einstein contributed to the development of quantum mechanics."
  ]
}`,
    }

    return examples[this.decompositionType]
  }

  /**
   * Decompose text into atomic claims
   */
  private async decomposeClaims(text: string): Promise<string[]> {
    const result = await generateObject({
      model: this.model,
      schema: ClaimDecompositionOutputSchema,
      prompt: `Decompose and break down each of the input sentences into one or more standalone statements. Each statement should be a standalone claim that can be independently verified.
Follow the level of atomicity and coverage as shown in the examples.

${this.getClaimDecompositionExamples()}

Now decompose this:
Input: "${text}"`,
    })

    return result.object.claims
  }

  /**
   * Verify claims against a premise using NLI
   */
  private async verifyClaims(
    premise: string,
    hypothesisList: string[]
  ): Promise<boolean[]> {
    if (hypothesisList.length === 0) {
      return []
    }

    const result = await generateObject({
      model: this.model,
      schema: NLIStatementOutputSchema,
      prompt: `Your task is to judge the faithfulness of a series of statements based on a given context. For each statement you must return verdict as 1 if the statement can be directly inferred based on the context or 0 if the statement can not be directly inferred based on the context.

Example:
Context: "John is a student at XYZ University. He is pursuing a degree in Computer Science. He is enrolled in several courses this semester, including Data Structures, Algorithms, and Database Management. John is a diligent student and spends a significant amount of time studying and completing assignments. He often stays late in the library to work on his projects."

Statements:
1. "John is majoring in Biology."
2. "John is taking a course on Artificial Intelligence."
3. "John is a dedicated student."
4. "John has a part-time job."

Expected Output:
{
  "statements": [
    {
      "statement": "John is majoring in Biology.",
      "reason": "John's major is explicitly mentioned as Computer Science. There is no information suggesting he is majoring in Biology.",
      "verdict": 0
    },
    {
      "statement": "John is taking a course on Artificial Intelligence.",
      "reason": "The context mentions the courses John is currently enrolled in, and Artificial Intelligence is not mentioned. Therefore, it cannot be deduced that John is taking a course on AI.",
      "verdict": 0
    },
    {
      "statement": "John is a dedicated student.",
      "reason": "The context states that he spends a significant amount of time studying and completing assignments. Additionally, it mentions that he often stays late in the library to work on his projects, which implies dedication.",
      "verdict": 1
    },
    {
      "statement": "John has a part-time job.",
      "reason": "There is no information given in the context about John having a part-time job.",
      "verdict": 0
    }
  ]
}

Now evaluate these:
Context: "${premise}"

Statements:
${hypothesisList.map((s, i) => `${i + 1}. "${s}"`).join('\n')}`,
    })

    return result.object.statements.map((s) => s.verdict === 1)
  }

  /**
   * Decompose and verify claims in one step
   */
  private async decomposeAndVerifyClaims(
    reference: string,
    response: string
  ): Promise<boolean[]> {
    const claims = await this.decomposeClaims(response)
    return await this.verifyClaims(reference, claims)
  }

  /**
   * Evaluate a single-turn sample
   */
  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    if (!sample.reference) {
      throw new Error(
        'FactualCorrectness metric requires reference to be present'
      )
    }

    try {
      const referenceResponsePromise = this.decomposeAndVerifyClaims(
        sample.response,
        sample.reference
      )

      const responseReferencePromise =
        this.mode !== 'precision'
          ? this.decomposeAndVerifyClaims(sample.reference, sample.response)
          : Promise.resolve([])

      const [referenceResponse, responseReference] = await Promise.all([
        referenceResponsePromise,
        responseReferencePromise,
      ])

      const tp = referenceResponse.filter((v) => v).length
      const fp = referenceResponse.filter((v) => !v).length
      const fn =
        this.mode !== 'precision'
          ? responseReference.filter((v) => !v).length
          : 0

      let score: number
      if (this.mode === 'precision') {
        score = tp / (tp + fp + 1e-8)
      } else if (this.mode === 'recall') {
        score = tp / (tp + fn + 1e-8)
      } else {
        score = fbetaScore(tp, fp, fn, this.beta)
      }

      score = Math.round(score * 100) / 100

      return {
        name: this.name,
        score,
        reason: `${this.mode} score: ${score.toFixed(
          2
        )} (TP: ${tp}, FP: ${fp}, FN: ${fn})`,
        metadata: {
          mode: this.mode,
          tp,
          fp,
          fn,
          beta: this.beta,
          atomicity: this.atomicity,
          coverage: this.coverage,
        },
      }
    } catch (error) {
      throw new Error(
        `Failed to evaluate factual correctness: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}
