import { LLMMetric, SingleTurnSample, MetricScore } from '@ai-sdk-eval/core'
import type { LanguageModel } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod'

/**
 * Schema for a single context recall classification
 */
const ContextRecallClassificationSchema = z.object({
  statement: z.string().describe('The statement from the answer'),
  reason: z.string().describe('The reason for the attribution decision'),
  attributed: z
    .number()
    .int()
    .min(0)
    .max(1)
    .describe(
      'Whether the statement can be attributed to the context (0 or 1)'
    ),
})

/**
 * Schema for context recall classifications output
 */
const ContextRecallClassificationsSchema = z.object({
  classifications: z.array(ContextRecallClassificationSchema),
})

type ContextRecallClassification = z.infer<
  typeof ContextRecallClassificationSchema
>
type ContextRecallClassifications = z.infer<
  typeof ContextRecallClassificationsSchema
>

/**
 * Options for configuring the ContextRecall metric
 */
export interface ContextRecallOptions {
  /** The language model to use for evaluation */
  model: LanguageModel
}

/**
 * ContextRecall metric estimates the recall of the retrieved context by analyzing
 * how much of the reference answer can be attributed to the retrieved contexts.
 *
 * The metric works by:
 * 1. Taking each sentence in the reference answer
 * 2. Classifying whether each sentence can be attributed to the retrieved contexts
 * 3. Computing recall as the proportion of attributed sentences
 *
 * This metric requires:
 * - query: The user's question
 * - retrievedContexts: The source documents retrieved
 * - reference: The ground truth answer
 *
 * Score ranges from 0 to 1, where 1 means all reference answer content
 * can be attributed to the retrieved contexts (perfect recall).
 */
export class ContextRecall extends LLMMetric<'context_recall'> {
  constructor(options: ContextRecallOptions) {
    super({
      name: 'context_recall',
      description:
        'Estimates context recall by analyzing how much of the reference answer can be attributed to retrieved contexts',
      model: options.model,
    })
  }

  /**
   * Classify each statement in the answer against the context
   */
  private async classifyStatements(
    question: string,
    context: string,
    answer: string
  ): Promise<ContextRecallClassifications> {
    const result = await generateObject({
      model: this.model,
      schema: ContextRecallClassificationsSchema,
      prompt: `Given a context, and an answer, analyze each sentence in the answer and classify if the sentence can be attributed to the given context or not. Use only 'Yes' (1) or 'No' (0) as a binary classification. Output json with reason.

Example:
Question: "What can you tell me about albert Albert Einstein?"
Context: "Albert Einstein (14 March 1879 - 18 April 1955) was a German-born theoretical physicist, widely held to be one of the greatest and most influential scientists of all time. Best known for developing the theory of relativity, he also made important contributions to quantum mechanics, and was thus a central figure in the revolutionary reshaping of the scientific understanding of nature that modern physics accomplished in the first decades of the twentieth century. His mass-energy equivalence formula E = mc2, which arises from relativity theory, has been called 'the world's most famous equation'. He received the 1921 Nobel Prize in Physics 'for his services to theoretical physics, and especially for his discovery of the law of the photoelectric effect', a pivotal step in the development of quantum theory. His work is also known for its influence on the philosophy of science. In a 1999 poll of 130 leading physicists worldwide by the British journal Physics World, Einstein was ranked the greatest physicist of all time. His intellectual achievements and originality have made Einstein synonymous with genius."
Answer: "Albert Einstein, born on 14 March 1879, was a German-born theoretical physicist, widely held to be one of the greatest and most influential scientists of all time. He received the 1921 Nobel Prize in Physics for his services to theoretical physics. He published 4 papers in 1905. Einstein moved to Switzerland in 1895."

Expected Output:
{
  "classifications": [
    {
      "statement": "Albert Einstein, born on 14 March 1879, was a German-born theoretical physicist, widely held to be one of the greatest and most influential scientists of all time.",
      "reason": "The date of birth of Einstein is mentioned clearly in the context.",
      "attributed": 1
    },
    {
      "statement": "He received the 1921 Nobel Prize in Physics for his services to theoretical physics.",
      "reason": "The exact sentence is present in the given context.",
      "attributed": 1
    },
    {
      "statement": "He published 4 papers in 1905.",
      "reason": "There is no mention about papers he wrote in the given context.",
      "attributed": 0
    },
    {
      "statement": "Einstein moved to Switzerland in 1895.",
      "reason": "There is no supporting evidence for this in the given context.",
      "attributed": 0
    }
  ]
}

Now analyze this:
Question: "${question}"
Context: "${context}"
Answer: "${answer}"`,
    })

    return result.object
  }

  /**
   * Compute the context recall score
   */
  private computeScore(classifications: ContextRecallClassification[]): number {
    if (classifications.length === 0) {
      return NaN
    }

    const attributedCount = classifications.filter(
      (c) => c.attributed === 1
    ).length
    return attributedCount / classifications.length
  }

  /**
   * Evaluate a single-turn sample
   */
  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    if (!sample.retrievedContexts || sample.retrievedContexts.length === 0) {
      throw new Error(
        'ContextRecall metric requires retrievedContexts to be present'
      )
    }

    try {
      const context = sample.retrievedContexts.join('\n')
      const classifications = await this.classifyStatements(
        sample.query,
        context,
        sample.response
      )

      if (classifications.classifications.length === 0) {
        return {
          name: this.name,
          score: 0,
          reason: 'No statements were found in the response',
        }
      }

      const score = this.computeScore(classifications.classifications)

      if (isNaN(score)) {
        return {
          name: this.name,
          score: 0,
          reason: 'The LLM did not return a valid classification',
        }
      }

      const roundedScore = Math.round(score * 10000) / 10000

      return {
        name: this.name,
        score: roundedScore,
        reason: `${
          classifications.classifications.filter((c) => c.attributed === 1)
            .length
        } out of ${
          classifications.classifications.length
        } statements from the response were attributed to the retrieved contexts`,
        metadata: {
          classifications: classifications.classifications,
        },
      }
    } catch (error) {
      throw new Error(
        `Failed to evaluate context recall: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}
