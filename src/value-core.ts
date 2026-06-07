import { directiveOf } from './lint-core'

export type ValueSpec =
  | { type: 'enum', values: string[] }
  | { type: 'integer', min?: number, max?: number }

export interface ValueFinding {
  line: number
  startCol: number
  length: number
  message: string
}

/**
 * Validates directive values against the authoritative OpenSSH value sets.
 * Only directives present in `specs` (booleans, small enumerations, and Port)
 * are checked; everything else is left alone. Pure (no vscode dependency).
 *
 * @param text - The full document text.
 * @param specs - Map of lower-cased directive name to its value spec.
 */
export function validateValues(text: string, specs: Map<string, ValueSpec>): ValueFinding[] {
  const findings: ValueFinding[] = []
  const lines = text.split('\n')

  lines.forEach((line, lineNo) => {
    const directive = directiveOf(line)
    if (!directive) {
      return
    }
    const spec = specs.get(directive.toLowerCase())
    if (!spec) {
      return
    }

    const indent = line.length - line.trimStart().length
    const afterDirective = line.slice(indent + directive.length)
    // SSH allows the keyword and value to be separated by whitespace and/or a
    // single '='.
    const sep = afterDirective.match(/^(\s*=?\s*)/)?.[1] ?? ''
    const valuePart = afterDirective.slice(sep.length)
    const valueToken = valuePart.split(/\s+/)[0] ?? ''
    if (valueToken === '') {
      return // missing value — not our concern here
    }

    const startCol = indent + directive.length + sep.length
    const message = checkValue(directive, valueToken, spec)
    if (message) {
      findings.push({ line: lineNo, startCol, length: valueToken.length, message })
    }
  })

  return findings
}

function checkValue(directive: string, token: string, spec: ValueSpec): string | undefined {
  if (spec.type === 'enum') {
    const ok = spec.values.some(v => v.toLowerCase() === token.toLowerCase())
    if (!ok) {
      return `Invalid value "${token}" for ${directive}. Expected one of: ${spec.values.join(', ')}.`
    }
    return undefined
  }

  // integer
  if (!/^\d+$/.test(token)) {
    return `${directive} expects an integer value, but got "${token}".`
  }
  const n = Number(token)
  if (spec.min !== undefined && n < spec.min) {
    return `${directive} value ${n} is below the minimum of ${spec.min}.`
  }
  if (spec.max !== undefined && n > spec.max) {
    return `${directive} value ${n} exceeds the maximum of ${spec.max}.`
  }
  return undefined
}
