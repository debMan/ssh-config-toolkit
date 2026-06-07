import type { Disposable, TextDocument, TextEdit as TextEditType } from 'vscode'
import { Range, TextEdit, workspace } from 'vscode'
import { computeCasingEdits } from '../casing-core'
import { canonicalCasing } from '../options'
import { isSupportedLanguage } from './utils'

/**
 * Normalises SSH directive keyword casing (e.g. `hOstNaME` -> `HostName`) using
 * the authoritative OpenSSH keyword list. Runs automatically on save when
 * `sshConfigToolkit.fixCasing.onSave` is enabled (default), and can also be
 * triggered manually.
 */
export class SSHCasingProvider {
  constructor(disposables: Disposable[]) {
    disposables.push(
      workspace.onWillSaveTextDocument((event) => {
        if (!isSupportedLanguage(event.document.languageId)) {
          return
        }
        const enabled = workspace
          .getConfiguration('sshConfigToolkit.fixCasing')
          .get<boolean>('onSave', true)
        if (!enabled) {
          return
        }
        event.waitUntil(Promise.resolve(buildEdits(event.document)))
      }),
    )
  }
}

/**
 * Builds the casing-normalisation edits for a document.
 */
export function buildEdits(document: TextDocument): TextEditType[] {
  return computeCasingEdits(document.getText(), canonicalCasing(document.languageId)).map((edit) => {
    const range = new Range(edit.line, edit.startCol, edit.line, edit.startCol + edit.length)
    return TextEdit.replace(range, edit.replacement)
  })
}
