// Lightweight tests for the vscode-free core logic. Run with: node test/core.test.mjs
// (after `npm run build`, which compiles src -> out).
import assert from 'node:assert'
import { formatSshConfig } from '../out/format-core.js'
import { directiveOf, levenshtein, closestKeyword, lintText } from '../out/lint-core.js'
import { computeCasingEdits } from '../out/casing-core.js'
import { validateValues } from '../out/value-core.js'

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ok - ${name}`)
}

// ---- formatter ----
check('indents directives under Host', () => {
  const input = 'Host foo\nHostName a.example.com\nUser bob\n'
  const out = formatSshConfig(input, 2)
  assert.strictEqual(out, 'Host foo\n  HostName a.example.com\n  User bob\n')
})

check('honours custom indent size', () => {
  const out = formatSshConfig('Host x\nUser y\n', 4)
  assert.strictEqual(out, 'Host x\n    User y\n')
})

check('inserts a blank line between blocks', () => {
  const input = 'Host a\nUser u\nHost b\nUser v\n'
  const out = formatSshConfig(input, 2)
  assert.strictEqual(out, 'Host a\n  User u\n\nHost b\n  User v\n')
})

check('collapses multiple blank lines', () => {
  const out = formatSshConfig('Host a\nUser u\n\n\n\nHost b\n', 2)
  assert.strictEqual(out, 'Host a\n  User u\n\nHost b\n')
})

check('removes blank lines inside a block and re-indents what follows', () => {
  // The reported bug: a blank line mid-block dropped indentation of later lines.
  const input = 'Host rpi-home\n  User debman\n  Port 53042\n\nHostname revolt-rpi.local\n\nHost rpi\n  Hostname home.debman.net\n'
  const out = formatSshConfig(input, 2)
  assert.strictEqual(
    out,
    'Host rpi-home\n  User debman\n  Port 53042\n  Hostname revolt-rpi.local\n\nHost rpi\n  Hostname home.debman.net\n',
  )
})

check('keeps a comment directly above Host attached and un-indented', () => {
  const input = '# Raspberry Pi\nHost rpi\n  User debman\n'
  assert.strictEqual(formatSshConfig(input, 2), '# Raspberry Pi\nHost rpi\n  User debman\n')
})

check('a comment detached by a blank introduces the next block', () => {
  const input = 'Host a\n  User u\n\n# about b\nHost b\n  User v\n'
  assert.strictEqual(
    formatSshConfig(input, 2),
    'Host a\n  User u\n\n# about b\nHost b\n  User v\n',
  )
})

check('indents a comment that sits inside a block', () => {
  const input = 'Host a\n  User u\n  # note about user\n  Port 22\n'
  assert.strictEqual(
    formatSshConfig(input, 2),
    'Host a\n  User u\n  # note about user\n  Port 22\n',
  )
})

// ---- directive parsing ----
check('directiveOf ignores comments and blanks', () => {
  assert.strictEqual(directiveOf('  # comment'), undefined)
  assert.strictEqual(directiveOf('   '), undefined)
  assert.strictEqual(directiveOf('  HostName x'), 'HostName')
})

// ---- levenshtein + suggestions ----
check('levenshtein basic distances', () => {
  assert.strictEqual(levenshtein('hostname', 'hostname'), 0)
  assert.strictEqual(levenshtein('hostnam', 'hostname'), 1)
})

const known = new Set(['host', 'hostname', 'user', 'port', 'identityfile'])
const canonical = new Map([
  ['host', 'Host'],
  ['hostname', 'HostName'],
  ['user', 'User'],
  ['port', 'Port'],
  ['identityfile', 'IdentityFile'],
])

check('suggests nearest keyword for a typo', () => {
  assert.strictEqual(closestKeyword('HostNam', known, canonical), 'HostName')
})

check('does not suggest for very different words', () => {
  assert.strictEqual(closestKeyword('Bananas', known, canonical), undefined)
})

// ---- linter ----
check('lintText flags unknown directives only', () => {
  const text = 'Host a\n  HostName x\n  Prot 22\n  User bob\n'
  const findings = lintText(text, known, canonical)
  assert.strictEqual(findings.length, 1)
  assert.strictEqual(findings[0].directive, 'Prot')
  assert.strictEqual(findings[0].line, 2)
  assert.strictEqual(findings[0].suggestion, 'Port')
})

check('lintText is case-insensitive for valid keywords', () => {
  const findings = lintText('host a\n  hostname x\n', known, canonical)
  assert.strictEqual(findings.length, 0)
})

// ---- casing fixer ----
const casing = new Map([
  ['host', 'Host'],
  ['hostname', 'HostName'],
  ['user', 'User'],
  ['identityfile', 'IdentityFile'],
])

check('computeCasingEdits normalises a mis-cased directive', () => {
  const text = 'Host foo\n  hOstNaME a.example.com\n'
  const edits = computeCasingEdits(text, casing)
  assert.strictEqual(edits.length, 1)
  assert.deepStrictEqual(edits[0], { line: 1, startCol: 2, length: 8, replacement: 'HostName' })
})

check('computeCasingEdits leaves correct casing and values alone', () => {
  // "User user" — the value "user" must NOT be touched, only the directive.
  const text = 'Host foo\n  HostName x\n  User user\n'
  const edits = computeCasingEdits(text, casing)
  assert.strictEqual(edits.length, 0)
})

check('computeCasingEdits ignores comments and unknown keywords', () => {
  const text = '# hostname in a comment\n  Frobnicate yes\n'
  const edits = computeCasingEdits(text, casing)
  assert.strictEqual(edits.length, 0)
})

check('computeCasingEdits handles multiple lines', () => {
  const text = 'host a\nIDENTITYFILE ~/.ssh/id\n'
  const edits = computeCasingEdits(text, casing)
  assert.strictEqual(edits.length, 2)
  assert.strictEqual(edits[0].replacement, 'Host')
  assert.strictEqual(edits[1].replacement, 'IdentityFile')
})

// ---- client/server keyword data integrity ----
import { readFileSync } from 'node:fs'
const readArr = p => JSON.parse(readFileSync(new URL(p, import.meta.url)))
const sshKw = new Set(readArr('../data/ssh-keywords.json').map(s => s.toLowerCase()))
const sshdKw = new Set(readArr('../data/sshd-keywords.json').map(s => s.toLowerCase()))

check('server set has server-only directives', () => {
  assert.ok(sshdKw.has('permitrootlogin'))
  assert.ok(sshdKw.has('subsystem'))
  assert.ok(sshdKw.has('listenaddress'))
})

check('client set has client-only directives', () => {
  assert.ok(sshKw.has('proxyjump'))
  assert.ok(sshKw.has('identityfile'))
})

check('sets are genuinely distinct (not merged)', () => {
  assert.ok(!sshdKw.has('proxyjump'), 'ProxyJump should not be a server directive')
  assert.ok(!sshKw.has('permitrootlogin'), 'PermitRootLogin should not be a client directive')
})

check('linter accepts server directives against the server set', () => {
  const canonical = new Map(readArr('../data/sshd-keywords.json').map(k => [k.toLowerCase(), k]))
  const text = 'Port 22\nPermitRootLogin no\nSubsystem sftp internal-sftp\n'
  assert.strictEqual(lintText(text, sshdKw, canonical).length, 0)
})

check('linter flags a client directive inside a server file', () => {
  const canonical = new Map(readArr('../data/sshd-keywords.json').map(k => [k.toLowerCase(), k]))
  const findings = lintText('ProxyJump bastion\n', sshdKw, canonical)
  assert.strictEqual(findings.length, 1)
  assert.strictEqual(findings[0].directive, 'ProxyJump')
})

// ---- value validation ----
const readObj = p => JSON.parse(readFileSync(new URL(p, import.meta.url)))
const toSpecMap = obj => new Map(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]))
const sshVals = toSpecMap(readObj('../data/ssh-values.json'))
const sshdVals = toSpecMap(readObj('../data/sshd-values.json'))

check('value data: PermitRootLogin enum is authoritative', () => {
  const spec = sshdVals.get('permitrootlogin')
  assert.strictEqual(spec.type, 'enum')
  for (const v of ['yes', 'no', 'prohibit-password', 'forced-commands-only']) {
    assert.ok(spec.values.includes(v), `expected ${v}`)
  }
})

check('value data: free-form/path directives are NOT validated', () => {
  // These accept paths/times/strings and must be absent to avoid false errors.
  for (const k of ['forwardagent', 'identityagent', 'loglevel', 'localforward', 'addkeystoagent']) {
    assert.ok(!sshVals.has(k), `${k} must not have a strict value spec`)
  }
})

check('flags an invalid enum value', () => {
  const f = validateValues('PermitRootLogin maybe\n', sshdVals)
  assert.strictEqual(f.length, 1)
  assert.strictEqual(f[0].line, 0)
  assert.strictEqual(f[0].startCol, 16)
  assert.strictEqual(f[0].length, 5)
  assert.match(f[0].message, /Invalid value "maybe" for PermitRootLogin/)
})

check('accepts valid enum values case-insensitively', () => {
  assert.strictEqual(validateValues('PermitRootLogin NO\n', sshdVals).length, 0)
  assert.strictEqual(validateValues('Compression yes\n', sshVals).length, 0)
  assert.strictEqual(validateValues('StrictHostKeyChecking accept-new\n', sshVals).length, 0)
})

check('handles the = separator', () => {
  assert.strictEqual(validateValues('Compression=yes\n', sshVals).length, 0)
  assert.strictEqual(validateValues('Compression = bogus\n', sshVals).length, 1)
})

check('validates Port as an integer in range', () => {
  assert.strictEqual(validateValues('Port 22\n', sshVals).length, 0)
  assert.strictEqual(validateValues('Port notaport\n', sshVals).length, 1)
  assert.match(validateValues('Port 70000\n', sshVals)[0].message, /exceeds the maximum/)
})

check('ignores directives without a value spec', () => {
  assert.strictEqual(validateValues('HostName example.com\nUser bob\nForwardAgent /run/agent.sock\n', sshVals).length, 0)
})

console.log(`\nAll ${passed} tests passed.`)
