import type { Disposable, HoverProvider, Position, ProviderResult, TextDocument } from 'vscode'
import { Hover, MarkdownString, languages } from 'vscode'
import { findOption } from '../options'
import { DOCUMENT_SELECTOR } from './utils'

/**
 * Shows a description of the SSH directive under the cursor on hover.
 */
export class SSHHoverProvider implements HoverProvider {
  constructor(disposables: Disposable[]) {
    disposables.push(languages.registerHoverProvider(DOCUMENT_SELECTOR, this))
  }

  provideHover(document: TextDocument, position: Position): ProviderResult<Hover> {
    const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z][\w-]*/)
    if (!wordRange) {
      return
    }

    const lineText = document.lineAt(position.line).text
    const firstCol = lineText.length - lineText.trimStart().length

    // Only the first token on a (non-comment) line is a directive.
    if (lineText.trimStart().startsWith('#') || wordRange.start.character !== firstCol) {
      return
    }

    const word = document.getText(wordRange)
    const option = findOption(document.languageId, word)
    if (!option) {
      return
    }

    const md = new MarkdownString()
    md.appendMarkdown(`**${option.label}**\n\n`)
    md.appendMarkdown(option.documentation.trim())
    return new Hover(md, wordRange)
  }
}
