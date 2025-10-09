import type { LanguageModel } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod'
import type { SingleTurnSample } from '@ai-sdk-eval/core'
import type { Scenario } from '../scenario/type'
import type { Synthesizer } from './type'
import type { ChunkNode } from '../graph/node'

const QuestionSchema = z.object({
  question: z.string().describe('The generated question'),
})

const AnswerSchema = z.object({
  answer: z.string().describe('The ground truth answer to the question'),
})

/**
 * Base abstract class for all synthesizers
 */
export abstract class BaseSynthesizer<T extends object = {}>
  implements Synthesizer<T>
{
  constructor(
    public readonly name: string,
    public readonly type: 'single-hop' | 'multi-hop',
    protected readonly model: LanguageModel
  ) {}

  /**
   * Generate a test sample from a scenario
   */
  async generate(scenario: Scenario<T>): Promise<SingleTurnSample> {
    const contexts = this.extractContexts(scenario)
    const question = await this.generateQuestion(scenario, contexts)
    const groundTruth = await this.generateGroundTruth(question, contexts)

    return {
      query: question,
      retrievedContexts: contexts,
      response: '',
      reference: groundTruth,
      metadata: {
        persona: scenario.persona.name,
        queryType: scenario.query.type,
        queryLength: scenario.query.length,
        queryStyle: scenario.query.style,
      },
    }
  }

  /**
   * Extract text contexts from scenario nodes
   */
  protected extractContexts(scenario: Scenario<T>): string[] {
    return scenario.context.nodes
      .filter((node) => node.type === 'chunk')
      .map((node) => (node as ChunkNode<T>).content)
  }

  /**
   * Generate a question from a scenario
   * Must be implemented by subclasses
   */
  protected abstract generateQuestion(
    scenario: Scenario<T>,
    contexts: string[]
  ): Promise<string>

  /**
   * Generate ground truth answer for a question
   */
  protected async generateGroundTruth(
    question: string,
    contexts: string[]
  ): Promise<string> {
    try {
      const result = await generateObject({
        model: this.model,
        schema: AnswerSchema,
        prompt: `
Answer the following question based on the provided contexts. Be concise and accurate.

Question: ${question}

Contexts:
${contexts.map((ctx, i) => `[${i + 1}] ${ctx}`).join('\n\n')}

Provide a clear, factual answer based only on the information in the contexts.
`.trim(),
      })

      return result.object.answer
    } catch (error) {
      console.error('Failed to generate ground truth:', error)
      throw new Error('Failed to generate ground truth')
    }
  }

  /**
   * Helper to generate a question using the LLM
   */
  protected async generateQuestionWithPrompt(prompt: string): Promise<string> {
    try {
      const result = await generateObject({
        model: this.model,
        schema: QuestionSchema,
        prompt,
      })

      return result.object.question
    } catch (error) {
      console.error('Failed to generate question:', error)
      throw new Error('Failed to generate question')
    }
  }

  /**
   * Get length guidance text for prompts
   */
  protected getLengthGuidance(length: 'short' | 'medium' | 'long'): string {
    switch (length) {
      case 'short':
        return 'a short question (few words)'
      case 'medium':
        return 'a medium-length question (1 sentence)'
      case 'long':
        return 'a longer, more detailed question (2-3 sentences)'
    }
  }

  /**
   * Get style guidance text for prompts
   */
  protected getStyleGuidance(
    style: 'web-search' | 'conversational' | 'technical'
  ): string {
    switch (style) {
      case 'web-search':
        return 'in a web search style (keyword-focused, direct)'
      case 'conversational':
        return 'in a conversational style (natural, as if asking a person)'
      case 'technical':
        return 'in a technical style (precise, domain-specific terminology)'
    }
  }
}
