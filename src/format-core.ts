/**
 * Pure SSH config formatting logic, with no dependency on the vscode API so it
 * can be unit-tested in plain Node.
 *
 * Indents directives under each Host/Match block and ensures a single blank
 * line separates blocks.
 */
export function formatSshConfig(text: string, indentSize: number): string {
  const indent = ' '.repeat(Math.max(0, indentSize))
  const lines = text.split('\n')
  let inBlock = false
  const out: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    const isBlockStart = /^(Host|Match)\b/i.test(trimmed)

    if (isBlockStart) {
      const prev = out[out.length - 1]
      if (out.length > 0 && prev !== undefined && prev.trim() !== '' && !prev.trim().startsWith('#')) {
        out.push('')
      }
      inBlock = true
      out.push(trimmed)
    } else if (trimmed === '') {
      inBlock = false
      out.push('')
    } else {
      out.push(inBlock ? `${indent}${trimmed}` : trimmed)
    }
  }

  // Collapse consecutive blank lines and trim trailing blanks.
  const collapsed: string[] = []
  for (const line of out) {
    if (line === '' && collapsed[collapsed.length - 1] === '') {
      continue
    }
    collapsed.push(line)
  }
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === '') {
    collapsed.pop()
  }
  return `${collapsed.join('\n')}\n`
}
