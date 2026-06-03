#!/usr/bin/env node
// Regenerates the value-validation specs from OpenSSH source:
//   - data/ssh-values.json   from readconf.c  (client)
//   - data/sshd-values.json  from servconf.c  (server)
//
// OpenSSH validates "multistate" directives (booleans and small enumerations)
// against fixed tables in these files. We extract:
//   1. the keyword table:      { "forwardagent", oForwardAgent }  -> name -> token
//   2. the multistate tables:  multistate_flag = { yes, no, true, false, ... }
//   3. the parser switch:       which token uses which table
// and emit  { "<lowercase directive>": { "type": "enum", "values": [...] } }.
//
// Directives parsed as integers, times, strings or paths are intentionally left
// out (their values are not a closed set). `Port` is added manually as the one
// universally-standard numeric range.
//
// Usage:
//   node scripts/update-values.mjs                 # fetch readconf.c + servconf.c from master
//   node scripts/update-values.mjs <openssh-dir>   # read both files from a local checkout

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAW = 'https://raw.githubusercontent.com/openssh/openssh-portable/master'
const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '..', 'data')

async function readFile(srcDir, name) {
  if (srcDir) {
    return readFileSync(resolve(process.cwd(), srcDir, name), 'utf8')
  }
  const res = await fetch(`${RAW}/${name}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${name}: ${res.status}`)
  }
  return res.text()
}

/** Parses `{ "name", oToken ... }` keyword entries -> Map(token -> [names]). */
function parseKeywordTable(src, tokenPrefix) {
  const map = new Map()
  const re = new RegExp(`\\{\\s*"([a-z0-9_]+)"\\s*,\\s*(${tokenPrefix}[A-Za-z0-9_]+)`, 'g')
  let m
  while ((m = re.exec(src)) != null) {
    const [, name, token] = m
    if (!map.has(token)) {
      map.set(token, [])
    }
    map.get(token).push(name)
  }
  return map
}

/** Parses every `multistate_NAME[] = { ... }` table -> Map(name -> [tokens]). */
function parseMultistateTables(src) {
  const tables = new Map()
  const re = /multistate_([a-z_]+)\[\]\s*=\s*\{([\s\S]*?)\}\s*;/g
  let m
  while ((m = re.exec(src)) != null) {
    const [, name, body] = m
    const tokens = []
    const tokRe = /\{\s*"([^"]+)"/g
    let t
    while ((t = tokRe.exec(body)) != null) {
      tokens.push(t[1])
    }
    tables.set(`multistate_${name}`, tokens)
  }
  return tables
}

/**
 * Walks the parser switch and maps each case token to a multistate table.
 *
 * Each `case oXxx:` owns the lines up to the next case label. We classify a
 * block as: a flag (boolean), a specific multistate table, OTHER (int / time /
 * string / path — e.g. ForwardAgent, which also accepts a path and must NOT be
 * treated as a strict enum), or empty (a fall-through that inherits the next
 * block's classification). Only blocks resolving to a multistate table are
 * returned.
 */
function mapTokensToTables(src, tokenPrefix) {
  const lines = src.split('\n')
  const caseRe = new RegExp(`^\\s*case\\s+(${tokenPrefix}[A-Za-z0-9_]+)\\s*:`)

  // Collect case lines (index + token) in order.
  const cases = []
  lines.forEach((line, i) => {
    const c = caseRe.exec(line)
    if (c) {
      cases.push({ token: c[1], line: i })
    }
    if (/^\s*(default|case)\s*[A-Za-z0-9_]*\s*:/.test(line) && !c) {
      cases.push({ token: null, line: i }) // `default:` boundary
    }
  })

  function classify(body) {
    // Priority: the case that *defines* the parse_flag label is a flag.
    if (/^\s*parse_flag\s*:/m.test(body)) {
      return 'multistate_flag'
    }
    if (/goto\s+parse_flag\b/.test(body)) {
      return 'multistate_flag'
    }
    // A non-multistate destination (path/int/time/string/etc.) — NOT an enum.
    // Checked before parse_multistate so ForwardAgent (sets multistate_flag but
    // then `goto parse_agent_path`) is correctly excluded.
    if (/goto\s+parse_(?!multistate\b)\w+/.test(body)) {
      return 'OTHER'
    }
    if (/goto\s+parse_multistate\b/.test(body) || /^\s*parse_multistate\s*:/m.test(body)) {
      const all = [...body.matchAll(/multistate_ptr\s*=\s*(multistate_[a-z_]+)/g)]
      return all.length ? all[all.length - 1][1] : 'multistate_flag'
    }
    return null // empty / fall-through / unknown
  }

  const own = cases.map((c, idx) => {
    if (c.token === null) {
      return 'OTHER'
    }
    const start = c.line + 1
    const end = idx + 1 < cases.length ? cases[idx + 1].line : lines.length
    return classify(lines.slice(start, end).join('\n'))
  })

  // Resolve fall-through: an empty block inherits the next block's class.
  const effective = own.slice()
  for (let i = effective.length - 2; i >= 0; i--) {
    if (effective[i] === null) {
      effective[i] = effective[i + 1]
    }
  }

  const result = new Map()
  cases.forEach((c, idx) => {
    const cls = effective[idx]
    if (c.token && cls && cls !== 'OTHER') {
      result.set(c.token, cls)
    }
  })
  return result
}

function buildSpec(src, tokenPrefix) {
  const keywordTable = parseKeywordTable(src, tokenPrefix)
  const tables = parseMultistateTables(src)
  const tokenToTable = mapTokensToTables(src, tokenPrefix)

  const spec = {}
  for (const [token, tableName] of tokenToTable) {
    const values = tables.get(tableName)
    if (!values) {
      continue
    }
    // Prefer the explicit keyword strings (client readconf.c has a string
    // table). The macro-generated server table has none, so fall back to the
    // canonical name encoded in the token itself (sPermitRootLogin -> ...).
    const names = keywordTable.get(token) ?? [token.slice(1).toLowerCase()]
    for (const name of names) {
      spec[name] = { type: 'enum', values }
    }
  }
  return spec
}

async function main() {
  const srcDir = process.argv[2]

  const readconf = await readFile(srcDir, 'readconf.c')
  const servconf = await readFile(srcDir, 'servconf.c')

  const ssh = buildSpec(readconf, 'o')
  const sshd = buildSpec(servconf, 's')

  // Port is the one universally-standard numeric range.
  ssh.port = { type: 'integer', min: 1, max: 65535 }
  sshd.port = { type: 'integer', min: 1, max: 65535 }

  writeFileSync(join(dataDir, 'ssh-values.json'), `${JSON.stringify(ssh, null, 2)}\n`)
  writeFileSync(join(dataDir, 'sshd-values.json'), `${JSON.stringify(sshd, null, 2)}\n`)
  console.log(`client: ${Object.keys(ssh).length} validated directives`)
  console.log(`server: ${Object.keys(sshd).length} validated directives`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
