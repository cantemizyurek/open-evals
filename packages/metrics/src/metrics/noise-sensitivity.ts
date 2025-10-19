import { LLMMetric, SingleTurnSample, MetricScore } from '@ai-sdk-eval/core'
import type { LanguageModel } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod'

/**
 * Schema for statement generation output
 */
const StatementGeneratorOutputSchema = z.object({
  statements: z.array(z.string()).describe('The generated statements'),
})

/**
 * Schema for a single faithfulness verdict
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

type StatementGeneratorOutput = z.infer<typeof StatementGeneratorOutputSchema>
type NLIStatementOutput = z.infer<typeof NLIStatementOutputSchema>

/**
 * Options for configuring the NoiseSensitivity metric
 */
export interface NoiseSensitivityOptions {
  /** The language model to use for evaluation */
  model: LanguageModel
  /** Mode for noise sensitivity evaluation: 'relevant' or 'irrelevant' */
  mode?: 'relevant' | 'irrelevant'
}

/**
 * NoiseSensitivity metric measures the extent to which the generated answer is influenced
 * by noise or irrelevant information in the retrieved contexts.
 *
 * The metric operates in two modes:
 * - **relevant**: Measures how many incorrect statements come from relevant retrieved contexts
 * - **irrelevant**: Measures how many incorrect statements come from irrelevant retrieved contexts
 *
 * The metric works by:
 * 1. Decomposing both the reference answer and the generated response into statements
 * 2. For each retrieved context, evaluating which statements are supported
 * 3. Identifying which contexts are relevant (support reference statements)
 * 4. Computing the proportion of incorrect statements that are faithful to relevant/irrelevant contexts
 *
 * This metric requires:
 * - query: The user's question
 * - response: The model's answer
 * - reference: The ground truth answer
 * - retrievedContexts: The source documents used to generate the response
 *
 * Score ranges from 0 to 1, where:
 * - In 'relevant' mode: Higher scores indicate more incorrect statements from relevant contexts
 * - In 'irrelevant' mode: Higher scores indicate more incorrect statements from irrelevant contexts
 */
export class NoiseSensitivity extends LLMMetric<'noise_sensitivity'> {
  private mode: 'relevant' | 'irrelevant'

  constructor(options: NoiseSensitivityOptions) {
    super({
      name: 'noise_sensitivity',
      description: `Measures the extent to which the generated answer is influenced by noise in retrieved contexts (mode: ${
        options.mode ?? 'relevant'
      })`,
      model: options.model,
    })
    this.mode = options.mode ?? 'relevant'

    if (this.mode !== 'relevant' && this.mode !== 'irrelevant') {
      throw new Error(
        `Invalid argument passed for 'mode': ${this.mode}. Must be 'relevant' or 'irrelevant'.`
      )
    }
  }

  /**
   * Generate atomic statements from the answer
   */
  private async generateStatements(
    question: string,
    answer: string
  ): Promise<StatementGeneratorOutput> {
    const result = await generateObject({
      model: this.model,
      schema: StatementGeneratorOutputSchema,
      prompt: `Given a question and an answer, analyze the complexity of each sentence in the answer. Break down each sentence into one or more fully understandable statements. Ensure that no pronouns are used in any statement. Format the outputs in JSON.

Example:
Question: "Who was Albert Einstein and what is he best known for?"
Answer: "He was a German-born theoretical physicist, widely acknowledged to be one of the greatest and most influential physicists of all time. He was best known for developing the theory of relativity, he also made important contributions to the development of the theory of quantum mechanics."

Expected Output:
{
  "statements": [
    "Albert Einstein was a German-born theoretical physicist.",
    "Albert Einstein is recognized as one of the greatest and most influential physicists of all time.",
    "Albert Einstein was best known for developing the theory of relativity.",
    "Albert Einstein also made important contributions to the development of the theory of quantum mechanics."
  ]
}

Now analyze this:
Question: "${question}"
Answer: "${answer}"`,
    })

    return result.object
  }

  /**
   * Evaluate faithfulness of statements against context
   */
  private async evaluateStatements(
    context: string,
    statements: string[]
  ): Promise<NLIStatementOutput> {
    const result = await generateObject({
      model: this.model,
      schema: NLIStatementOutputSchema,
      prompt: `Your task is to judge the faithfulness of a series of statements based on a given context. For each statement you must return verdict as 1 if the statement can be directly inferred based on the context or 0 if the statement can not be directly inferred based on the context.

Example 1:
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

Example 2:
Context: "Photosynthesis is a process used by plants, algae, and certain bacteria to convert light energy into chemical energy."

Statements:
1. "Albert Einstein was a genius."

Expected Output:
{
  "statements": [
    {
      "statement": "Albert Einstein was a genius.",
      "reason": "The context and statement are unrelated",
      "verdict": 0
    }
  ]
}

Now evaluate these:
Context: "${context}"

Statements:
${statements.map((s, i) => `${i + 1}. "${s}"`).join('\n')}`,
    })

    return result.object
  }

  /**
   * Compute the noise sensitivity score based on the mode
   */
  private computeScore(answers: {
    retrieved2GroundTruth: boolean[][]
    retrieved2Answer: boolean[][]
    groundTruth2Answer: boolean[]
  }): number {
    const { retrieved2GroundTruth, retrieved2Answer, groundTruth2Answer } =
      answers

    const incorrect = groundTruth2Answer.map((v) => !v)

    if (retrieved2Answer.length === 0 || incorrect.every((v) => !v)) {
      return 0
    }

    const numContexts = retrieved2GroundTruth.length
    const relevantRetrieved = new Array(numContexts).fill(false)

    for (let ctxIdx = 0; ctxIdx < numContexts; ctxIdx++) {
      const contextVerdicts = retrieved2GroundTruth[ctxIdx]
      if (!contextVerdicts) continue

      for (let stmtIdx = 0; stmtIdx < contextVerdicts.length; stmtIdx++) {
        if (contextVerdicts[stmtIdx]) {
          relevantRetrieved[ctxIdx] = true
          break
        }
      }
    }

    const relevantFaithful = retrieved2Answer.map((answerVerdicts) => {
      const maxIdx = Math.min(answerVerdicts.length, relevantRetrieved.length)
      for (let ctxIdx = 0; ctxIdx < maxIdx; ctxIdx++) {
        if (relevantRetrieved[ctxIdx] && answerVerdicts[ctxIdx]) {
          return true
        }
      }
      return false
    })

    if (this.mode === 'irrelevant') {
      const irrelevantFaithful = retrieved2Answer.map((answerVerdicts) => {
        const maxIdx = Math.min(answerVerdicts.length, relevantRetrieved.length)
        for (let ctxIdx = 0; ctxIdx < maxIdx; ctxIdx++) {
          if (!relevantRetrieved[ctxIdx] && answerVerdicts[ctxIdx]) {
            return true
          }
        }
        return false
      })

      const minLength = Math.min(
        irrelevantFaithful.length,
        relevantFaithful.length
      )
      const exclusiveIrrelevantFaithful = new Array(minLength)
        .fill(false)
        .map((_, idx) => irrelevantFaithful[idx] && !relevantFaithful[idx])

      const countLength = Math.min(
        exclusiveIrrelevantFaithful.length,
        incorrect.length
      )
      if (countLength === 0) return 0

      let count = 0
      for (let i = 0; i < countLength; i++) {
        if (exclusiveIrrelevantFaithful[i] && incorrect[i]) {
          count++
        }
      }

      return count / incorrect.length
    } else {
      const countLength = Math.min(relevantFaithful.length, incorrect.length)
      if (countLength === 0) return 0

      let count = 0
      for (let i = 0; i < countLength; i++) {
        if (relevantFaithful[i] && incorrect[i]) {
          count++
        }
      }

      return count / incorrect.length
    }
  }

  /**
   * Evaluate a single-turn sample
   */
  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    if (!sample.retrievedContexts || sample.retrievedContexts.length === 0) {
      throw new Error(
        'NoiseSensitivity metric requires retrievedContexts to be present'
      )
    }

    if (!sample.reference) {
      throw new Error(
        'NoiseSensitivity metric requires reference to be present'
      )
    }

    try {
      const [groundTruthStatements, answerStatements] = await Promise.all([
        this.generateStatements(sample.query, sample.reference),
        this.generateStatements(sample.query, sample.response),
      ])

      if (groundTruthStatements.statements.length === 0) {
        return {
          name: this.name,
          score: 0,
          reason: 'No statements were generated from the reference answer',
        }
      }

      if (answerStatements.statements.length === 0) {
        return {
          name: this.name,
          score: 0,
          reason: 'No statements were generated from the response',
        }
      }

      const gtVerdictsPromises = sample.retrievedContexts.map((ctx) =>
        this.evaluateStatements(ctx, groundTruthStatements.statements)
      )

      const ansVerdictsPromises = sample.retrievedContexts.map((ctx) =>
        this.evaluateStatements(ctx, answerStatements.statements)
      )

      const [gtVerdictsList, ansVerdictsList] = await Promise.all([
        Promise.all(gtVerdictsPromises),
        Promise.all(ansVerdictsPromises),
      ])

      const groundTruth2AnswerVerdicts = await this.evaluateStatements(
        sample.reference,
        answerStatements.statements
      )

      const expectedGtLength = groundTruthStatements.statements.length
      const expectedAnsLength = answerStatements.statements.length

      for (let i = 0; i < gtVerdictsList.length; i++) {
        const actualLength = gtVerdictsList[i].statements.length
        if (actualLength !== expectedGtLength) {
          throw new Error(
            `LLM returned ${actualLength} verdicts for ground truth statements against context ${i}, expected ${expectedGtLength}. This indicates an issue with the evaluation model's response.`
          )
        }
      }

      for (let i = 0; i < ansVerdictsList.length; i++) {
        const actualLength = ansVerdictsList[i].statements.length
        if (actualLength !== expectedAnsLength) {
          throw new Error(
            `LLM returned ${actualLength} verdicts for answer statements against context ${i}, expected ${expectedAnsLength}. This indicates an issue with the evaluation model's response.`
          )
        }
      }

      if (groundTruth2AnswerVerdicts.statements.length !== expectedAnsLength) {
        throw new Error(
          `LLM returned ${groundTruth2AnswerVerdicts.statements.length} verdicts for answer statements against reference, expected ${expectedAnsLength}. This indicates an issue with the evaluation model's response.`
        )
      }

      const retrieved2GroundTruth = gtVerdictsList.map((verdicts) =>
        verdicts.statements.map((v) => v.verdict === 1)
      )

      const retrieved2Answer = answerStatements.statements.map((_, stmtIdx) =>
        ansVerdictsList.map(
          (verdicts) => verdicts.statements[stmtIdx].verdict === 1
        )
      )

      const groundTruth2Answer = groundTruth2AnswerVerdicts.statements.map(
        (v) => v.verdict === 1
      )

      const score = this.computeScore({
        retrieved2GroundTruth,
        retrieved2Answer,
        groundTruth2Answer,
      })

      const roundedScore = Math.round(score * 10000) / 10000

      const incorrectCount = groundTruth2Answer.filter((v) => !v).length
      const modeDescription =
        this.mode === 'relevant'
          ? 'relevant retrieved contexts'
          : 'irrelevant retrieved contexts'

      return {
        name: this.name,
        score: roundedScore,
        reason: `${Math.round(
          score * incorrectCount
        )} out of ${incorrectCount} incorrect statements were faithful to ${modeDescription}`,
        metadata: {
          mode: this.mode,
          groundTruthStatements: groundTruthStatements.statements,
          answerStatements: answerStatements.statements,
          incorrectStatementsCount: incorrectCount,
        },
      }
    } catch (error) {
      throw new Error(
        `Failed to evaluate noise sensitivity: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}
