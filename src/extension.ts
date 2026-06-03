import type { Disposable, ExtensionContext } from 'vscode'
import { commands } from 'vscode'
import { fixCasingNow, openUserConfig, setLanguageMode } from './commands'
import { loadLanguage } from './options'
import {
  SSHCasingProvider,
  SSHCompletionItemsProvider,
  SSHDiagnosticsProvider,
  SSHDocumentLinkProvider,
  SSHFormatProvider,
  SSHHoverProvider,
} from './providers'

/**
 * Activates the SSH Config Pro extension.
 */
export function activate(context: ExtensionContext): void {
  // Eagerly load both client and server data (descriptions + authoritative
  // keyword lists) so the providers have them ready.
  loadLanguage(context.extensionPath, 'ssh-config')
  loadLanguage(context.extensionPath, 'sshd-config')

  const disposables: Disposable[] = []

  disposables.push(
    commands.registerCommand('ssh-config-pro.openUserConfig', () => openUserConfig()),
    commands.registerCommand('ssh-config-pro.setLanguageMode', () => setLanguageMode('ssh-config')),
    commands.registerCommand('ssh-config-pro.setSshdLanguageMode', () => setLanguageMode('sshd-config')),
    commands.registerCommand('ssh-config-pro.fixCasing', () => fixCasingNow()),
  )

  // Language feature providers.
  new SSHCompletionItemsProvider(disposables, context.extensionPath)
  new SSHHoverProvider(disposables)
  new SSHDocumentLinkProvider(disposables)
  new SSHFormatProvider(disposables)
  new SSHCasingProvider(disposables)

  // Keyword linter (manages its own subscriptions via context).
  // eslint-disable-next-line no-new
  new SSHDiagnosticsProvider(context)

  context.subscriptions.push(...disposables)
}

export function deactivate(): void {
  // noop
}
