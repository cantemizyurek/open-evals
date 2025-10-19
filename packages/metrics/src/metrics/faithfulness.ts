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
 * Options for configuring the Faithfulness metric
 */
export interface FaithfulnessOptions {
  /** The language model to use for evaluation */
  model: LanguageModel
}

/**
 * Faithfulness metric evaluates how grounded the model's response is in the provided context.
 *
 * The metric works by:
 * 1. Breaking down the response into atomic statements
 * 2. Checking each statement against the retrieved contexts
 * 3. Computing a score based on the ratio of faithful statements
 *
 * This metric requires:
 * - query: The user's question
 * - response: The model's answer
 * - retrievedContexts: The source documents used to generate the response
 *
 * Score ranges from 0 to 1, where 1 means all statements are faithful to the context.
 */
export class Faithfulness extends LLMMetric<'faithfulness'> {
  constructor(options: FaithfulnessOptions) {
    super({
      name: 'faithfulness',
      description:
        "Evaluates the faithfulness of the model's response to the retrieved contexts",
      model: options.model,
    })
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
   * Compute the faithfulness score
   */
  private computeScore(verdicts: NLIStatementOutput): number {
    if (verdicts.statements.length === 0) {
      return NaN
    }

    const faithfulStatements = verdicts.statements.filter(
      (v) => v.verdict === 1
    ).length
    return faithfulStatements / verdicts.statements.length
  }

  /**
   * Evaluate a single-turn sample
   */
  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    if (!sample.retrievedContexts || sample.retrievedContexts.length === 0) {
      throw new Error(
        'Faithfulness metric requires retrievedContexts to be present'
      )
    }

    try {
      const statementResult = await this.generateStatements(
        sample.query,
        sample.response
      )

      if (statementResult.statements.length === 0) {
        return {
          name: this.name,
          score: 0,
          reason: 'No statements were generated from the answer',
        }
      }

      const context = sample.retrievedContexts.join('\n')
      const verdicts = await this.evaluateStatements(
        context,
        statementResult.statements
      )

      const score = this.computeScore(verdicts)

      return {
        name: this.name,
        score,
        reason: `${
          verdicts.statements.filter((v) => v.verdict === 1).length
        } out of ${
          verdicts.statements.length
        } statements were faithful to the context`,
        metadata: {
          statements: verdicts.statements,
        },
      }
    } catch (error) {
      throw new Error(
        `Failed to evaluate faithfulness: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}
