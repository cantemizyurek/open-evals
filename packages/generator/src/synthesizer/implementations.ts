import type { LanguageModel } from 'ai'
import { BaseSynthesizer } from './base-synthesizer'
import type { Scenario } from '../scenario/type'
import { type } from 'os'
import { Synthesizer } from './type'

/**
 * Generates specific, detailed questions from single context nodes
 * These questions can be answered using information from just one context
 */
export class SingleHopSpecificQuerySynthesizer<
  T extends object = {}
> extends BaseSynthesizer<T> {
  constructor(model: LanguageModel) {
    super('SingleHopSpecificQuerySynthesizer', 'single-hop', model)
  }

  protected async generateQuestion(
    scenario: Scenario<T>,
    contexts: string[]
  ): Promise<string> {
    if (contexts.length === 0) {
      throw new Error(
        'SingleHopSpecificQuerySynthesizer requires at least one context'
      )
    }

    const context = contexts[0]
    const { persona, query } = scenario

    const prompt = `
You are generating a test question for a RAG (Retrieval Augmented Generation) evaluation.

Persona: ${persona.name}
Persona Description: ${persona.description}

Generate ${this.getLengthGuidance(query.length)} ${this.getStyleGuidance(
      query.style
    )}.

The question should:
- Be specific and detailed
- Be answerable using ONLY the information in the context below
- Be relevant to the persona's interests and knowledge level
- Focus on specific facts, details, or concepts mentioned in the context

Context:
${context}

Generate a single, clear question that this persona would ask.
`.trim()

    return this.generateQuestionWithPrompt(prompt)
  }
}

/**
 * Generates abstract questions that require synthesizing information from multiple contexts
 * These questions ask about high-level concepts or patterns
 */
export class MultiHopAbstractQuerySynthesizer<
  T extends object = {}
> extends BaseSynthesizer<T> {
  constructor(model: LanguageModel) {
    super('MultiHopAbstractQuerySynthesizer', 'multi-hop', model)
  }

  protected async generateQuestion(
    scenario: Scenario<T>,
    contexts: string[]
  ): Promise<string> {
    if (contexts.length < 2) {
      throw new Error(
        'MultiHopAbstractQuerySynthesizer requires at least two contexts'
      )
    }

    const { persona, query } = scenario

    const prompt = `
You are generating a test question for a RAG (Retrieval Augmented Generation) evaluation.

Persona: ${persona.name}
Description: ${persona.description}

Generate ${this.getLengthGuidance(query.length)} ${this.getStyleGuidance(
      query.style
    )}.

The question should:
- Be abstract and conceptual
- Require synthesizing information from multiple contexts
- Ask about high-level patterns, themes, or relationships
- Be relevant to the persona's interests and knowledge level
- NOT reference specific details from any single context

Contexts:
${contexts.map((ctx, i) => `[${i + 1}] ${ctx}`).join('\n\n')}

Generate a single, clear question that requires understanding information across all contexts.
`.trim()

    return this.generateQuestionWithPrompt(prompt)
  }
}

/**
 * Generates specific questions that require information from multiple contexts
 * These questions ask about specific facts or details that span multiple contexts
 */
export class MultiHopSpecificQuerySynthesizer<
  T extends object = {}
> extends BaseSynthesizer<T> {
  constructor(model: LanguageModel) {
    super('MultiHopSpecificQuerySynthesizer', 'multi-hop', model)
  }

  protected async generateQuestion(
    scenario: Scenario<T>,
    contexts: string[]
  ): Promise<string> {
    if (contexts.length < 2) {
      throw new Error(
        'MultiHopSpecificQuerySynthesizer requires at least two contexts'
      )
    }

    const { persona, query } = scenario

    const prompt = `
You are generating a test question for a RAG (Retrieval Augmented Generation) evaluation.

Persona: ${persona.name}
Description: ${persona.description}

Generate ${this.getLengthGuidance(query.length)} ${this.getStyleGuidance(
      query.style
    )}.

The question should:
- Be specific and detailed
- Require connecting specific facts or details from multiple contexts
- Ask about relationships or comparisons between specific elements
- Be relevant to the persona's interests and knowledge level
- Reference or imply specific details that appear across different contexts

Contexts:
${contexts.map((ctx, i) => `[${i + 1}] ${ctx}`).join('\n\n')}

Generate a single, clear question that requires information from multiple contexts to answer.
`.trim()

    return this.generateQuestionWithPrompt(prompt)
  }
}

/**
 * Factory function to create a synthesizer
 * @param model - The language model to use
 * @param type - The type of synthesizer to create
 * @returns The synthesizer
 */
export function createSynthesizer<T extends object = {}>(
  model: LanguageModel,
  type: 'single-hop-specific' | 'multi-hop-abstract' | 'multi-hop-specific'
): Synthesizer<T> {
  if (type === 'single-hop-specific') {
    return new SingleHopSpecificQuerySynthesizer<T>(model)
  }
  if (type === 'multi-hop-abstract') {
    return new MultiHopAbstractQuerySynthesizer<T>(model)
  }
  if (type === 'multi-hop-specific') {
    return new MultiHopSpecificQuerySynthesizer<T>(model)
  }
  throw new Error(`Invalid synthesizer type: ${type}`)
}
