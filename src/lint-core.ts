/**
 * Pure linting helpers, free of any vscode dependency so they can be unit
 * tested in plain Node.
 */

export interface LintFinding {
  line: number
  startCol: number
  directive: string
  suggestion?: string
}

/**
 * Extracts the leading directive keyword from a config line, or undefined if
 * the line is blank or a comment.
 */
export function directiveOf(line: string): string | undefined {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('#')) {
    return undefined
  }
  const match = trimmed.match(/^([A-Za-z][\w-]*)/)
  return match ? match[1] : undefined
}

/**
 * Scans config text and returns a finding for every line whose directive is
 * not in the set of known (lower-cased) keywords.
 */
export function lintText(
  text: string,
  knownLower: Set<string>,
  canonical: Map<string, string>,
): LintFinding[] {
  const findings: LintFinding[] = []
  const lines = text.split('\n')

  lines.forEach((text, lineNo) => {
    const directive = directiveOf(text)
    if (!directive || knownLower.has(directive.toLowerCase())) {
      return
    }
    const startCol = text.length - text.trimStart().length
    findings.push({
      line: lineNo,
      startCol,
      directive,
      suggestion: closestKeyword(directive, knownLower, canonical),
    })
  })

  return findings
}

/**
 * Returns the closest known keyword (by edit distance) if it is a plausible
 * typo, using canonical casing for the suggestion.
 */
export function closestKeyword(
  word: string,
  knownLower: Set<string>,
  canonical: Map<string, string>,
): string | undefined {
  const lower = word.toLowerCase()
  let best: string | undefined
  let bestDist = Infinity
  for (const candidate of knownLower) {
    const dist = levenshtein(lower, candidate)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  // Allow up to ~1/3 of the word length (min 2) to edit, so common typos and
  // single transpositions (which cost 2 in plain Levenshtein) still match.
  if (best && bestDist <= Math.max(2, Math.floor(lower.length / 3))) {
    return canonical.get(best) ?? best
  }
  return undefined
}

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) {
    return n
  }
  if (n === 0) {
    return m
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0))
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}
