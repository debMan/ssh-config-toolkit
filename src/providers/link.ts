import { homedir } from 'node:os'
import { isAbsolute } from 'node:path'
import type {
  Disposable,
  DocumentLinkProvider,
  ProviderResult,
  TextDocument,
} from 'vscode'
import {
  DocumentLink,
  Range,
  Uri,
  languages,
} from 'vscode'
import { DOCUMENT_SELECTOR } from './utils'

/**
 * Turns `Include` and `IdentityFile`/`CertificateFile` paths into clickable
 * links. Resolves `~`, absolute paths, and paths relative to the config file.
 */
export class SSHDocumentLinkProvider implements DocumentLinkProvider {
  constructor(disposables: Disposable[]) {
    disposables.push(languages.registerDocumentLinkProvider(DOCUMENT_SELECTOR, this))
  }

  provideDocumentLinks(document: TextDocument): ProviderResult<DocumentLink[]> {
    const PATH_DIRECTIVE = /^(\s*)(Include|IdentityFile|CertificateFile|UserKnownHostsFile)(\s+)(\S+)/i
    const links: DocumentLink[] = []

    for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
      const text = document.lineAt(lineNo).text
      if (text.trimStart().startsWith('#')) {
        continue
      }
      const match = PATH_DIRECTIVE.exec(text)
      if (!match) {
        continue
      }

      const rawPath = match[4]
      // Globs cannot resolve to a single file; skip linking them.
      if (/[*?[\]]/.test(rawPath)) {
        continue
      }

      const target = resolvePath(rawPath, document.uri)
      if (!target) {
        continue
      }

      const startCol = match[1].length + match[2].length + match[3].length
      const range = new Range(lineNo, startCol, lineNo, startCol + rawPath.length)
      links.push(new DocumentLink(range, target))
    }

    return links
  }
}

/**
 * Resolves a path written in an ssh config to a file Uri.
 */
function resolvePath(raw: string, documentUri: Uri): Uri | undefined {
  try {
    if (raw.startsWith('~/') || raw === '~') {
      const rest = raw === '~' ? '' : raw.slice(2)
      return Uri.file(`${homedir()}/${rest}`)
    }
    if (isAbsolute(raw)) {
      return Uri.file(raw)
    }
    // Relative paths in ssh_config are resolved against ~/.ssh, but when editing
    // an arbitrary file we fall back to the document's own directory.
    if (documentUri.scheme === 'file') {
      return Uri.joinPath(documentUri, '..', raw)
    }
    return Uri.file(`${homedir()}/.ssh/${raw}`)
  } catch {
    return undefined
  }
}
