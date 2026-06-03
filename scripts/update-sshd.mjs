#!/usr/bin/env node
// Regenerates the sshd (server) data files from the official OpenSSH
// sshd_config(5) manual page:
//   - data/sshd-keywords.json   canonical directive names
//   - data/sshd-options.json    directive -> description (for hover)
//
// Usage:
//   node scripts/update-sshd.mjs                  # fetch sshd_config.5 from openssh-portable (master)
//   node scripts/update-sshd.mjs <path-or-url>    # parse a local file or a URL
//
// Descriptions are produced with a lightweight mdoc-to-text converter. It is
// deliberately simple: it strips inline macros and keeps their arguments, which
// yields readable (if not pixel-perfect) hover text.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_SOURCE
  = 'https://raw.githubusercontent.com/openssh/openssh-portable/master/sshd_config.5'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '..', 'data')

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
  return res.text()
}

/** Converts a single mdoc line to plain text. */
function convertLine(line) {
  if (!line.startsWith('.')) {
    return line
  }
  const parts = line.slice(1).trim().split(/\s+/)
  const macro = parts[0]
  const rest = parts.slice(1)
  switch (macro) {
    case 'Xr': {
      const [name = '', section = '', ...punct] = rest
      return `${name}(${section})${punct.length ? ` ${punct.join(' ')}` : ''}`
    }
    case 'Fl':
      return `-${rest.join(' ')}`
    case 'Dq':
      return `"${rest.join(' ')}"`
    case 'Sq':
      return `'${rest.join(' ')}'`
    case 'Nm':
      return 'sshd'
    case 'Pp':
    case 'Bd':
    case 'Ed':
    case 'Bl':
    case 'El':
      return '\n'
    case 'Cm':
    case 'Ar':
    case 'Pa':
    case 'Ic':
    case 'Va':
    case 'Dv':
    case 'Sy':
    case 'Em':
    case 'Li':
    case 'Sx':
    case 'No':
    case 'It':
    case 'Aq':
    case 'Qq':
      return rest.join(' ')
    default:
      return rest.join(' ')
  }
}

function cleanText(parts) {
  let text = parts.join(' ')
  text = text
    .replace(/ +/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim()
  return text
}

function parse(man) {
  const lines = man.split('\n')
  const entries = []
  let current = null

  for (const raw of lines) {
    const m = raw.match(/^\.It Cm ([A-Z][A-Za-z0-9]*)\b/)
    if (m) {
      if (current) {
        entries.push(current)
      }
      current = { label: m[1], parts: [] }
      continue
    }
    if (!current) {
      continue
    }
    // A new list item that is not a directive ends the current description.
    if (/^\.It\b/.test(raw)) {
      entries.push(current)
      current = null
      continue
    }
    current.parts.push(convertLine(raw))
  }
  if (current) {
    entries.push(current)
  }

  // De-duplicate, keeping the first (primary) definition of each directive.
  const seen = new Set()
  const unique = []
  for (const e of entries) {
    const key = e.label.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    unique.push({ label: e.label, documentation: cleanText(e.parts) })
  }
  return unique
}

async function main() {
  const arg = process.argv[2]
  const source = arg || DEFAULT_SOURCE
  console.log(`Reading sshd_config.5 from: ${source}`)

  const man = /^https?:\/\//.test(source)
    ? await fetchText(source)
    : readFileSync(resolve(process.cwd(), source), 'utf8')

  const options = parse(man)
  if (options.length < 50) {
    throw new Error(`Only found ${options.length} directives — source looks wrong, aborting.`)
  }

  const keywords = options
    .map(o => o.label)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  writeFileSync(join(dataDir, 'sshd-keywords.json'), `${JSON.stringify(keywords, null, 2)}\n`)
  writeFileSync(join(dataDir, 'sshd-options.json'), `${JSON.stringify(options, null, 2)}\n`)
  console.log(`Wrote ${keywords.length} keywords and ${options.length} descriptions.`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
