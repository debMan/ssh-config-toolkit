import type {
  CompletionItemProvider,
  Disposable,
  Position,
  ProviderResult,
  TextDocument,
} from 'vscode'
import {
  CompletionItem,
  CompletionItemKind,
  MarkdownString,
  SnippetString,
  languages,
} from 'vscode'
import { loadOptions } from '../options'
import { DOCUMENT_SELECTOR } from './utils'

/**
 * Provides autocompletion for SSH config directives and a couple of handy
 * block snippets.
 */
export class SSHCompletionItemsProvider implements CompletionItemProvider {
  private readonly extensionPath: string

  constructor(disposables: Disposable[], extensionPath: string) {
    this.extensionPath = extensionPath
    disposables.push(
      languages.registerCompletionItemProvider(DOCUMENT_SELECTOR, this),
    )
  }

  provideCompletionItems(document: TextDocument, position: Position): ProviderResult<CompletionItem[]> {
    const linePrefix = document.lineAt(position.line).text.slice(0, position.character)

    // Suggest directive names only at the start of a line (the keyword position).
    // After the first token we are typing a value, so suppress keyword noise.
    const beforeCursor = linePrefix.trimStart()
    const typingDirective = !/\s/.test(beforeCursor)

    const items: CompletionItem[] = []

    if (typingDirective) {
      for (const option of loadOptions(this.extensionPath, document.languageId)) {
        const item = new CompletionItem(option.label, CompletionItemKind.Keyword)
        item.detail = 'SSH directive'
        item.documentation = new MarkdownString(option.documentation.trim())
        item.insertText = `${option.label} `
        items.push(item)
      }
    }

    items.push(this.tunnelSnippet(), this.hostSnippet())
    return items
  }

  private tunnelSnippet(): CompletionItem {
    const item = new CompletionItem('Configure Tunnel', CompletionItemKind.Snippet)
    item.documentation = new MarkdownString('Insert a template for a forwarded tunnel connection.')
    item.insertText = new SnippetString(
      'Host ${1:alias}\n\tHostName ${2:host}\n\tLocalForward ${3:localPort} ${4:remoteHost}:${5:remotePort}\n\tUser ${6:user}\n',
    )
    return item
  }

  private hostSnippet(): CompletionItem {
    const item = new CompletionItem('Configure Host', CompletionItemKind.Snippet)
    item.documentation = new MarkdownString('Insert a basic Host block.')
    item.insertText = new SnippetString(
      'Host ${1:alias}\n\tHostName ${2:host}\n\tUser ${3:user}\n\tPort ${4:22}\n\tIdentityFile ${5:~/.ssh/id_ed25519}\n',
    )
    return item
  }
}
