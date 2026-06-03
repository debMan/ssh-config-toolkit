import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SSHOption } from './types'

export type LanguageId = 'ssh-config' | 'sshd-config'

interface LanguageFiles {
  options: string
  keywords: string
  extra: string
}

const LANGUAGE_FILES: Record<LanguageId, LanguageFiles> = {
  'ssh-config': {
    options: 'ssh-options.json',
    keywords: 'ssh-keywords.json',
    extra: 'ssh-keywords-extra.json',
  },
  'sshd-config': {
    options: 'sshd-options.json',
    keywords: 'sshd-keywords.json',
    extra: 'sshd-keywords-extra.json',
  },
}

interface LanguageData {
  options: SSHOption[]
  descByLower: Map<string, SSHOption>
  keywords: string[]
  canonicalByLower: Map<string, string>
}

const cache = new Map<LanguageId, LanguageData>()

function isSupported(langId: string): langId is LanguageId {
  return langId === 'ssh-config' || langId === 'sshd-config'
}

function readJson<T>(extensionPath: string, file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(join(extensionPath, 'data', file), { encoding: 'utf8' })) as T
  } catch (error) {
    console.error(`[ssh-config-pro] Failed to read data/${file}:`, error)
    return undefined
  }
}

const EMPTY: LanguageData = {
  options: [],
  descByLower: new Map(),
  keywords: [],
  canonicalByLower: new Map(),
}

/**
 * Loads (and caches) the directive descriptions and authoritative keyword set
 * for a given language. The keyword set is the official OpenSSH list plus a
 * curated set of deprecated/vendor keywords, and is the single source of truth
 * for the linter and the casing fixer.
 */
export function loadLanguage(extensionPath: string, langId: string): LanguageData {
  if (!isSupported(langId)) {
    return EMPTY
  }
  const cached = cache.get(langId)
  if (cached) {
    return cached
  }

  const files = LANGUAGE_FILES[langId]
  const options = readJson<SSHOption[]>(extensionPath, files.options) ?? []
  const official = readJson<string[]>(extensionPath, files.keywords) ?? []
  const extra = readJson<string[]>(extensionPath, files.extra) ?? []

  const descByLower = new Map<string, SSHOption>()
  for (const option of options) {
    descByLower.set(option.label.toLowerCase(), option)
  }

  const canonicalByLower = new Map<string, string>()
  for (const name of [...official, ...extra]) {
    if (!canonicalByLower.has(name.toLowerCase())) {
      canonicalByLower.set(name.toLowerCase(), name)
    }
  }

  const data: LanguageData = {
    options,
    descByLower,
    keywords: [...canonicalByLower.values()],
    canonicalByLower,
  }
  cache.set(langId, data)
  return data
}

/** Description database (for completion details), for one language. */
export function loadOptions(extensionPath: string, langId: string): SSHOption[] {
  return loadLanguage(extensionPath, langId).options
}

/** Look up a directive's description, case-insensitively, for one language. */
export function findOption(langId: string, name: string): SSHOption | undefined {
  return cache.get(langId as LanguageId)?.descByLower.get(name.toLowerCase())
}

/** Set of known directive names, lower-cased, for one language. */
export function knownKeywordsLower(langId: string): Set<string> {
  const data = cache.get(langId as LanguageId)
  return new Set(data ? [...data.canonicalByLower.keys()] : [])
}

/** Map of lower-cased directive name to canonical casing, for one language. */
export function canonicalCasing(langId: string): Map<string, string> {
  return cache.get(langId as LanguageId)?.canonicalByLower ?? new Map()
}
