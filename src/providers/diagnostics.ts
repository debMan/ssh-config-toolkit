import type {
  Diagnostic,
  Disposable,
  ExtensionContext,
  TextDocument,
} from 'vscode'
import {
  DiagnosticSeverity,
  Range,
  languages,
  workspace,
} from 'vscode'
import { canonicalCasing, knownKeywordsLower, valueSpecs } from '../options'
import { lintText } from '../lint-core'
import { validateValues } from '../value-core'
import { isSupportedLanguage } from './utils'

const COLLECTION_NAME = 'ssh-config-toolkit'

/**
 * Lints SSH config documents, flagging directives that are not recognised SSH
 * keywords. Behaviour is controlled by the `sshConfigToolkit.lint.*` settings.
 */
export class SSHDiagnosticsProvider {
  private readonly collection = languages.createDiagnosticCollection(COLLECTION_NAME)
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(context: ExtensionContext) {
    const subs: Disposable[] = [
      this.collection,
      workspace.onDidOpenTextDocument(doc => this.lint(doc)),
      workspace.onDidChangeTextDocument(e => this.scheduleLint(e.document)),
      workspace.onDidCloseTextDocument(doc => this.collection.delete(doc.uri)),
      workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('sshConfigToolkit.lint')) {
          this.lintAll()
        }
      }),
    ]
    context.subscriptions.push(...subs)
    this.lintAll()
  }

  private scheduleLint(document: TextDocument): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => this.lint(document), 350)
  }

  private lintAll(): void {
    for (const doc of workspace.textDocuments) {
      this.lint(doc)
    }
  }

  private lint(document: TextDocument): void {
    if (!isSupportedLanguage(document.languageId)) {
      return
    }

    const config = workspace.getConfiguration('sshConfigToolkit.lint')
    if (!config.get<boolean>('enabled', true)) {
      this.collection.delete(document.uri)
      return
    }

    const severity = toSeverity(config.get<string>('severity', 'warning'))
    const known = knownKeywordsLower(document.languageId)
    for (const extra of config.get<string[]>('allowedKeywords', [])) {
      known.add(extra.toLowerCase())
    }
    const canonical = canonicalCasing(document.languageId)
    const text = document.getText()

    const diagnostics: Diagnostic[] = lintText(text, known, canonical).map((f) => {
      const range = new Range(f.line, f.startCol, f.line, f.startCol + f.directive.length)
      const message = f.suggestion
        ? `Unknown SSH directive "${f.directive}". Did you mean "${f.suggestion}"?`
        : `Unknown SSH directive "${f.directive}".`
      return { range, message, severity, source: 'ssh-config-toolkit' }
    })

    if (config.get<boolean>('validateValues', true)) {
      for (const f of validateValues(text, valueSpecs(document.languageId))) {
        diagnostics.push({
          range: new Range(f.line, f.startCol, f.line, f.startCol + f.length),
          message: f.message,
          severity,
          source: 'ssh-config-toolkit',
        })
      }
    }

    this.collection.set(document.uri, diagnostics)
  }
}

function toSeverity(value: string): DiagnosticSeverity {
  switch (value) {
    case 'error':
      return DiagnosticSeverity.Error
    case 'information':
      return DiagnosticSeverity.Information
    case 'hint':
      return DiagnosticSeverity.Hint
    default:
      return DiagnosticSeverity.Warning
  }
}
