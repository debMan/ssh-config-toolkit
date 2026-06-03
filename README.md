# SSH Config Pro

All-in-one editing support for SSH configuration files in VS Code. This is a fork that merges and fixes two existing extensions:

- **[ssh-config-syntax-highlighter](https://github.com/mousavian/ssh-config-syntax-highlighter)** by R. Mousavian — a solid, self-contained syntax highlighter.
- **[vscode-ssh-config-enhanced](https://github.com/jamief/vscode-ssh-config-enhanced)** by jamief — hover docs, completion, formatting, and Include links.

It keeps the reliable, standalone highlighting of the first and the language-intelligence features of the second, with the bugs fixed and several features added.

## Installation

Install the [SSH Config Pro](https://github.com/debMan/ssh-config-pro) extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=debman.ssh-config-pro), or from the cli:

```shell
code --install-extension debman.ssh-config-pro
```

## Features

- **Client *and* server configs** — full support for both `ssh_config` (client) and `sshd_config` (the SSH **server** daemon), each with its own grammar and its own directive set, so client-only and server-only keywords are highlighted, completed, and linted correctly.
- **Standalone syntax highlighting** — self-contained TextMate grammars. No dependency on Remote-SSH or any other extension.
- **Works on files in any path** — detection by filename (`config`, `ssh_config`, `sshd_config`), by glob (`**/.ssh/config`, `/etc/ssh/ssh_config`, `/etc/ssh/sshd_config`, …), and by first-line content. For anything unusual, run **“SSH Config: Treat Current File as SSH Config / SSHD Config.”**
- **Hover descriptions** — hover any directive to see what it does (95 keywords documented from the `ssh_config(5)` manual).
- **Autocompletion** — real keyword completion for every directive, plus `Configure Host` and `Configure Tunnel` block snippets.
- **Keyword linter** — flags unknown/misspelled directives with a “did you mean …?” suggestion. Severity is configurable.
- **Fix keyword casing on save** — normalises directive keywords to their canonical casing (e.g. `hOstNaME` → `HostName`) using the official OpenSSH keyword list. On by default; also available as the command **“SSH Config: Fix Directive Casing.”** Only the leading directive on each line is changed — values are never touched.
- **Formatter** — indents directives under each `Host`/`Match` block and normalises blank lines. Run *Format Document*.
- **Include / key-file links** — `Include`, `IdentityFile`, `CertificateFile`, and `UserKnownHostsFile` paths become Ctrl/Cmd-clickable. Resolves `~`, absolute, and relative paths.
- **Open user config** — command **“SSH Config: Open User Configuration (~/.ssh/config)”**, working correctly on macOS, Linux, and Windows.

## What was fixed from the originals

- The “Open User Configuration” command used the Windows-only `USERPROFILE` variable, so it always failed on macOS/Linux. It now uses the OS home directory on every platform.
- The enhanced extension declared a **hard dependency on `ms-vscode-remote.remote-ssh`** and never defined the `ssh_config` language itself (its grammar was injection-only). Without Remote-SSH installed nothing activated. This fork defines its own language and standalone grammar, so it works on its own.
- “Completion” previously offered only two hardcoded snippets; it now completes all real SSH directives.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `sshConfigPro.format.indentSize` | `2` | Spaces used to indent directives when formatting. |
| `sshConfigPro.lint.enabled` | `true` | Turn the keyword linter on/off. |
| `sshConfigPro.lint.severity` | `warning` | `error`, `warning`, `information`, or `hint`. |
| `sshConfigPro.lint.allowedKeywords` | `[]` | Extra directive names to treat as valid (custom or newer keywords). |
| `sshConfigPro.fixCasing.onSave` | `true` | Normalise directive keyword casing on save. |

## Keyword source & updates

The authoritative directive lists are generated from the official OpenSSH man pages — the source of truth for directive names and their canonical casing:

- `data/ssh-keywords.json` ← `ssh_config(5)` (client)
- `data/sshd-keywords.json` + `data/sshd-options.json` ← `sshd_config(5)` (server)

A small curated set of deprecated/vendor keywords lives alongside each (`data/ssh-keywords-extra.json`, `data/sshd-keywords-extra.json`) so older configs are still recognised.

To refresh against a newer OpenSSH release for a future build:

```bash
node scripts/update-keywords.mjs            # client: fetch latest ssh_config.5
node scripts/update-sshd.mjs                # server: fetch latest sshd_config.5
# both accept a local file path or URL as an argument instead of fetching
```

## Install the packaged build

1. In VS Code open the Extensions view, click the `…` menu → **Install from VSIX…**, and choose `ssh-config-pro-*.vsix`.
   (Or from a terminal: `code --install-extension ssh-config-pro-*.vsix`.)
2. Open your `~/.ssh/config` — highlighting, hover, completion, and linting activate automatically.

## Build from source

```bash
npm install
npm run build      # compile TypeScript -> out/
node test/core.test.mjs   # run the unit tests
npm run package    # produce the .vsix (requires @vscode/vsce)
```

## License

[MIT](https://github.com/debMan/ssh-config-pro/blob/main/LICENSE). Directive descriptions in [`data/ssh-options.json`](https://github.com/debMan/ssh-config-pro/blob/main/data/ssh-options.json) derive from OpenSSH documentation; see [`data/OPTIONS-LICENSE`](https://github.com/debMan/ssh-config-pro/blob/main/data/OPTIONS-LICENSE).
