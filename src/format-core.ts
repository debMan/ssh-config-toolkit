/**
 * Pure SSH config formatting logic, with no dependency on the vscode API so it
 * can be unit-tested in plain Node.
 *
 * Model: a block runs from a `Host`/`Match` line to the next one. Every
 * directive inside a block is indented; blank lines *inside* a block are
 * removed (a blank line does not end a block in SSH config). Consecutive blocks
 * are separated by exactly one blank line. A comment that sits directly above a
 * `Host`/`Match` line stays attached to it (un-indented, no separating blank);
 * a comment detached by a blank line is treated as introducing the next block.
 */
export function formatSshConfig(text: string, indentSize: number): string {
  const indent = ' '.repeat(Math.max(0, indentSize))
  const lines = text.split('\n')
  const out: string[] = []
  let inBlock = false

  const isHost = (s: string) => /^(Host|Match)\b/i.test(s)
  const isComment = (s: string) => s.startsWith('#')

  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()

    // Blank lines are dropped here; separators are re-inserted around blocks.
    if (trimmed === '') {
      i++
      continue
    }

    if (isComment(trimmed)) {
      // Gather the consecutive comment run.
      const group: string[] = []
      let j = i
      while (j < lines.length && lines[j].trim() !== '' && isComment(lines[j].trim())) {
        group.push(lines[j].trim())
        j++
      }
      // Does this run introduce a block? Only if it is detached from any
      // preceding directive (start of file or preceded by a blank line) and the
      // next non-blank line is a Host/Match.
      let k = j
      while (k < lines.length && lines[k].trim() === '') {
        k++
      }
      const detached = i === 0 || lines[i - 1].trim() === ''
      const introducesBlock = detached && k < lines.length && isHost(lines[k].trim())

      if (introducesBlock) {
        if (out.length > 0 && out[out.length - 1] !== '') {
          out.push('')
        }
        for (const c of group) {
          out.push(c)
        }
        inBlock = false // the following Host will not add another separator
      } else {
        for (const c of group) {
          out.push(inBlock ? `${indent}${c}` : c)
        }
      }
      i = j
      continue
    }

    if (isHost(trimmed)) {
      const prev = out[out.length - 1]
      if (out.length > 0 && prev !== '' && !prev.startsWith('#')) {
        out.push('')
      }
      inBlock = true
      out.push(trimmed)
      i++
      continue
    }

    // Ordinary directive.
    out.push(inBlock ? `${indent}${trimmed}` : trimmed)
    i++
  }

  // Safety net: collapse any accidental double blanks and trim trailing blanks.
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
