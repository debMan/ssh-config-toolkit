# Changelog

## 1.2.0

### Added
- **`sshd_config` (SSH server) support.** New `sshd-config` language with its own standalone grammar (`source.sshd-config`), detected for `sshd_config`, `/etc/ssh/sshd_config`, and `**/sshd_config.d/*`. Hover, completion, the keyword linter, and the on-save casing fixer all use the server directive set, kept separate from the client set so client-only and server-only keywords are validated correctly.
- Server directive data generated from the official `sshd_config(5)` man page (`data/sshd-keywords.json`, `data/sshd-options.json`), plus a curated deprecated/vendor list (`data/sshd-keywords-extra.json`) and a `scripts/update-sshd.mjs` regen script.
- Command "SSH Config: Treat Current File as SSHD Config (server)".

## 1.1.1

### Changed
- Renamed configuration keys from `ssh-config-pro.*` to `sshConfigPro.*` so the VS Code Settings UI shows a clean "Ssh Config Pro" breadcrumb instead of "Ssh-config-pro". Command ids, the extension id, and the language id are unchanged. If you had set any of these settings, update the key prefix to `sshConfigPro`.

## 1.1.0

### Added
- **Fix keyword casing on save** — normalises directive keywords to their canonical casing (e.g. `hOstNaME` → `HostName`). Controlled by `ssh-config-pro.fixCasing.onSave` (default on), with a manual command "SSH Config: Fix Directive Casing".
- Authoritative keyword list now generated from the official OpenSSH `ssh_config(5)` man page (`data/ssh-keywords.json`, 104 directives), plus a curated set of deprecated/vendor keywords (`data/ssh-keywords-extra.json`). Added `scripts/update-keywords.mjs` to regenerate it for future builds.

### Changed
- The linter and casing fixer now share this single, official source of truth for directive names and casing.

## 1.0.0

Initial release — a fork merging `ssh-config-syntax-highlighter` and `vscode-ssh-config-enhanced`.

### Added
- Standalone TextMate grammar (no dependency on Remote-SSH or any other extension).
- File detection by filename, glob pattern, and first-line content, plus a command to set the language mode manually.
- Real keyword autocompletion for all SSH directives, plus Host and Tunnel block snippets.
- Configurable keyword linter with "did you mean …?" suggestions (`ssh-config-pro.lint.*`).
- Document links for `Include`, `IdentityFile`, `CertificateFile`, and `UserKnownHostsFile`.

### Fixed
- "Open User Configuration" now uses the OS home directory instead of the Windows-only `USERPROFILE` variable, so it works on macOS and Linux.
- Removed the hard `extensionDependency` on `ms-vscode-remote.remote-ssh`; the extension now defines its own language and activates on its own.
- Path links now resolve `~`, absolute, and relative paths correctly and skip globs.
