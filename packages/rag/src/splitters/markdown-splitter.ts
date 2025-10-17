import type { BaseChunkOptions } from '../types'
import { RecursiveCharacterSplitter } from './recursive-character'

export class MarkdownTransformer extends RecursiveCharacterSplitter {
  private static readonly MARKDOWN_SEPARATORS = [
    // Headers
    '\n#{1,6} ',
    // Code blocks
    '```\n',
    // Horizontal rules
    '\n\\*\\*\\*+\n',
    '\n---+\n',
    '\n___+\n',
    // Paragraph breaks
    '\n\n',
    // Single newlines
    '\n',
    // Spaces
    ' ',
    // Empty string
    '',
  ]

  constructor(options: BaseChunkOptions = {}) {
    super({
      ...options,
      separators: MarkdownTransformer.MARKDOWN_SEPARATORS,
      isSeparatorRegex: true,
    })
  }
}
