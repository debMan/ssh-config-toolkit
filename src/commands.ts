import { lstat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Uri, WorkspaceEdit, languages, window, workspace } from 'vscode'
import { buildEdits } from './providers/casing'
import { isSupportedLanguage } from './providers/utils'

/**
 * Opens the current user's SSH config (~/.ssh/config), creating an untitled
 * buffer at that path if the file does not yet exist.
 *
 * Cross-platform: uses os.homedir() rather than the Windows-only USERPROFILE
 * variable, which is why the original extension failed on macOS/Linux.
 */
export async function openUserConfig(): Promise<void> {
  const home = homedir()
  if (!home) {
    window.showErrorMessage('SSH Config Toolkit: could not determine your home directory.')
    return
  }

  const configPath = join(home, '.ssh', 'config')
  const exists = await fileExists(configPath)
  const uri = exists
    ? Uri.file(configPath)
    : Uri.file(configPath).with({ scheme: 'untitled' })

  const document = await workspace.openTextDocument(uri)
  await window.showTextDocument(document)
}

/**
 * Forces the active editor's language mode, so files in non-standard locations
 * get full support on demand.
 *
 * @param langId - 'ssh-config' (client) or 'sshd-config' (server).
 */
export async function setLanguageMode(langId: 'ssh-config' | 'sshd-config'): Promise<void> {
  const editor = window.activeTextEditor
  if (!editor) {
    window.showInformationMessage('SSH Config Toolkit: open a file first.')
    return
  }
  await languages.setTextDocumentLanguage(editor.document, langId)
}

/**
 * Normalises directive keyword casing in the active editor on demand.
 */
export async function fixCasingNow(): Promise<void> {
  const editor = window.activeTextEditor
  if (!editor || !isSupportedLanguage(editor.document.languageId)) {
    window.showInformationMessage('SSH Config Toolkit: open an SSH config file first.')
    return
  }

  const edits = buildEdits(editor.document)
  if (edits.length === 0) {
    window.showInformationMessage('SSH Config Toolkit: all directive casing is already correct.')
    return
  }

  const workspaceEdit = new WorkspaceEdit()
  workspaceEdit.set(editor.document.uri, edits)
  await workspace.applyEdit(workspaceEdit)
  window.showInformationMessage(`SSH Config Toolkit: fixed casing on ${edits.length} directive(s).`)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch {
    return false
  }
}
