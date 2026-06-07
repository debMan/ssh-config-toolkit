import type {
  Disposable,
  DocumentFormattingEditProvider,
  ProviderResult,
  TextDocument,
  TextEdit as TextEditType,
} from 'vscode'
import { Range, TextEdit, languages, workspace } from 'vscode'
import { formatSshConfig } from '../format-core'
import { DOCUMENT_SELECTOR } from './utils'

/**
 * Formats SSH config documents: indents directives under each Host/Match block
 * and ensures a single blank line separates blocks.
 */
export class SSHFormatProvider implements DocumentFormattingEditProvider {
  constructor(disposables: Disposable[]) {
    disposables.push(
      languages.registerDocumentFormattingEditProvider(DOCUMENT_SELECTOR, this),
    )
  }

  provideDocumentFormattingEdits(document: TextDocument): ProviderResult<TextEditType[]> {
    const indentSize = workspace
      .getConfiguration('sshConfigToolkit.format')
      .get<number>('indentSize', 2)

    const text = document.getText()
    const formatted = formatSshConfig(text, indentSize)

    if (text === formatted) {
      return []
    }

    const fullRange = new Range(
      document.positionAt(0),
      document.positionAt(text.length),
    )
    return [TextEdit.replace(fullRange, formatted)]
  }
}
