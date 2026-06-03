import type { DocumentSelector } from 'vscode'

export { directiveOf } from '../lint-core'

/**
 * Targets both the client (ssh-config) and server (sshd-config) languages in
 * any scheme (file, untitled, etc.) so the providers work regardless of where
 * the file lives or whether it is saved.
 */
export const DOCUMENT_SELECTOR: DocumentSelector = [
  { language: 'ssh-config' },
  { language: 'sshd-config' },
]

/** True for the languages this extension provides intelligence for. */
export function isSupportedLanguage(langId: string): boolean {
  return langId === 'ssh-config' || langId === 'sshd-config'
}
