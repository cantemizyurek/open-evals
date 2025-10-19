import {
  EmbeddingMetric,
  SingleTurnSample,
  MetricScore,
} from '@ai-sdk-eval/core'
import type { EmbeddingModel } from 'ai'
import { embedMany, cosineSimilarity } from 'ai'

/**
 * Options for configuring the AnswerSimilarity metric
 */
export interface AnswerSimilarityOptions {
  /** The embedding model to use for semantic similarity calculation */
  model: EmbeddingModel
  /**
   * Optional threshold for binary output.
   * If provided, scores >= threshold will be 1, otherwise 0.
   */
  threshold?: number
}

/**
 * AnswerSimilarity metric scores the semantic similarity between
 * a ground truth (reference) answer and a generated answer (response).
 *
 * The metric works by:
 * 1. Embedding both the reference and response using the provided embedding model
 * 2. Normalizing the embeddings to unit vectors
 * 3. Computing cosine similarity between the normalized embeddings
 * 4. Optionally applying a threshold for binary output
 *
 * This metric requires:
 * - response: The model's answer
 * - reference: The ground truth/reference answer
 *
 * Score ranges from -1 to 1 (or 0 to 1 for binary output with threshold),
 * where 1 means perfect semantic similarity.
 *
 * Based on the SAS paper: https://arxiv.org/pdf/2108.06130.pdf
 */
export class AnswerSimilarity extends EmbeddingMetric<'answer_similarity'> {
  protected threshold?: number

  constructor(options: AnswerSimilarityOptions) {
    super({
      name: 'answer_similarity',
      description:
        'Scores the semantic similarity of ground truth with generated answer using embeddings',
      model: options.model,
    })
    this.threshold = options.threshold
  }

  /**
   * Compute the semantic similarity score
   */
  protected async computeScore(
    reference: string,
    response: string
  ): Promise<number> {
    const groundTruth = reference || ' '
    const answer = response || ' '

    const { embeddings } = await embedMany({
      model: this.model,
      values: [groundTruth, answer],
    })

    const [embedding1, embedding2] = embeddings

    let score = cosineSimilarity(embedding1, embedding2)

    if (this.threshold !== undefined) {
      score = score >= this.threshold ? 1 : 0
    }

    return score
  }

  /**
   * Evaluate a single-turn sample
   */
  async evaluateSingleTurn(sample: SingleTurnSample): Promise<MetricScore> {
    if (!sample.reference) {
      throw new Error(
        'AnswerSimilarity metric requires reference to be present'
      )
    }

    try {
      const score = await this.computeScore(sample.reference, sample.response)

      const roundedScore = Math.round(score * 10000) / 10000

      return {
        name: this.name,
        score: roundedScore,
        reason: this.threshold
          ? `Answer similarity ${
              roundedScore >= this.threshold ? 'meets' : 'does not meet'
            } threshold of ${this.threshold}`
          : `Answer similarity score: ${roundedScore.toFixed(4)}`,
      }
    } catch (error) {
      throw new Error(
        `Failed to evaluate answer similarity: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}
