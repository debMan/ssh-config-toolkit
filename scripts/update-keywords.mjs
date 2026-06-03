#!/usr/bin/env node
// Regenerates data/ssh-keywords.json from the official OpenSSH ssh_config(5)
// manual page, which is the authoritative source for directive names and their
// canonical casing.
//
// Usage:
//   node scripts/update-keywords.mjs                # fetch from openssh-portable (master)
//   node scripts/update-keywords.mjs <path-to-ssh_config.5>
//   node scripts/update-keywords.mjs <url>
//
// The man page documents each directive as an mdoc list item:  ".It Cm HostName"
// We extract every such entry whose name starts with an uppercase letter
// (argument values in nested lists are lower-cased and thus excluded).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_SOURCE
  = 'https://raw.githubusercontent.com/openssh/openssh-portable/master/ssh_config.5'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, '..', 'data', 'ssh-keywords.json')

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
  return res.text()
}

function extractKeywords(man) {
  const set = new Set()
  for (const line of man.split('\n')) {
    const m = line.match(/^\.It Cm ([A-Z][A-Za-z0-9]*)\b/)
    if (m) {
      set.add(m[1])
    }
  }
  return [...set].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
}

async function main() {
  const arg = process.argv[2]
  const source = arg && !/^https?:\/\//.test(arg) ? arg : (arg || DEFAULT_SOURCE)
  console.log(`Reading ssh_config.5 from: ${source}`)

  const man = /^https?:\/\//.test(source)
    ? await fetchText(source)
    : readFileSync(resolve(process.cwd(), source), 'utf8')

  const keywords = extractKeywords(man)
  if (keywords.length < 50) {
    throw new Error(`Only found ${keywords.length} keywords — source looks wrong, aborting.`)
  }

  writeFileSync(outFile, `${JSON.stringify(keywords, null, 2)}\n`)
  console.log(`Wrote ${keywords.length} keywords to ${join('data', 'ssh-keywords.json')}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
