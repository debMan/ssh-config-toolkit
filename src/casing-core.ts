import { directiveOf } from './lint-core'

export interface CasingEdit {
  line: number
  startCol: number
  length: number
  replacement: string
}

/**
 * Computes the edits needed to normalise every directive keyword in the given
 * text to its canonical casing. Only the leading directive token on each line
 * is considered; comments, blank lines, values, and unknown keywords are left
 * untouched.
 *
 * Pure (no vscode dependency) so it can be unit-tested in plain Node.
 *
 * @param text - The full document text.
 * @param canonicalByLower - Map of lower-cased keyword to canonical casing.
 */
export function computeCasingEdits(
  text: string,
  canonicalByLower: Map<string, string>,
): CasingEdit[] {
  const edits: CasingEdit[] = []
  const lines = text.split('\n')

  lines.forEach((line, lineNo) => {
    const directive = directiveOf(line)
    if (!directive) {
      return
    }
    const canonical = canonicalByLower.get(directive.toLowerCase())
    if (!canonical || canonical === directive) {
      return
    }
    const startCol = line.length - line.trimStart().length
    edits.push({
      line: lineNo,
      startCol,
      length: directive.length,
      replacement: canonical,
    })
  })

  return edits
}
