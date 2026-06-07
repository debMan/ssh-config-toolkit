# Changelog

## 1.3.2

### Fixed

- Updated the name to publish on VS Code Marketplace
- Update the project icon.
- Update the README

## 1.3.1

### Fixed

- Formatter no longer treats a blank line as the end of a `Host`/`Match` block. Blank lines inside a block are now removed and the directives after them keep their indentation (previously they were left flush against the left margin). A comment directly above a `Host`/`Match` line stays attached to it; a comment separated by a blank line introduces the next block.

## 1.3.0

### Added

- **Value validation.** The linter now checks directive values against the official OpenSSH value sets — e.g. `PermitRootLogin maybe`, `Compression sometimes`, or a non-numeric `Port` are flagged with the list of accepted values. Only directives with a fixed, documented set of values (booleans, enumerations, and `Port`) are checked; free-form directives (paths, times, algorithm lists, `ForwardAgent`, `IdentityAgent`, etc.) are deliberately left alone to avoid false positives. Toggle with `sshConfigToolkit.lint.validateValues` (default on).
- Value sets generated from the `multistate` tables in OpenSSH's `readconf.c` / `servconf.c` / `servconf.h` (`data/ssh-values.json`, `data/sshd-values.json`), with a `scripts/update-values.mjs` regen script.

## 1.2.1

### Changed

- Updated `README.md`, preparing to publish to the VS Code Marketplace

## 1.2.0

### Added

- **`sshd_config` (SSH server) support.** New `sshd-config` language with its own standalone grammar (`source.sshd-config`), detected for `sshd_config`, `/etc/ssh/sshd_config`, and `**/sshd_config.d/*`. Hover, completion, the keyword linter, and the on-save casing fixer all use the server directive set, kept separate from the client set so client-only and server-only keywords are validated correctly.
- Server directive data generated from the official `sshd_config(5)` man page (`data/sshd-keywords.json`, `data/sshd-options.json`), plus a curated deprecated/vendor list (`data/sshd-keywords-extra.json`) and a `scripts/update-sshd.mjs` regen script.
- Command "SSH Config: Treat Current File as SSHD Config (server)".

## 1.1.1

### Changed

- Renamed configuration keys from `ssh-config-toolkit.*` to `sshConfigToolkit.*` so the VS Code Settings UI shows a clean "Ssh Config Toolkit" breadcrumb instead of "Ssh-config-toolkit". Command ids, the extension id, and the language id are unchanged. If you had set any of these settings, update the key prefix to `sshConfigToolkit`.

## 1.1.0

### Added

- **Fix keyword casing on save** — normalises directive keywords to their canonical casing (e.g. `hOstNaME` → `HostName`). Controlled by `ssh-config-toolkit.fixCasing.onSave` (default on), with a manual command "SSH Config: Fix Directive Casing".
- Authoritative keyword list now generated from the official OpenSSH `ssh_config(5)` man page (`data/ssh-keywords.json`, 104 directives), plus a curated set of deprecated/vendor keywords (`data/ssh-keywords-extra.json`). Added `scripts/update-keywords.mjs` to regenerate it for future builds.

### Changed

- The linter and casing fixer now share this single, official source of truth for directive names and casing.

## 1.0.0

Initial release — a fork merging `ssh-config-syntax-highlighter` and `vscode-ssh-config-enhanced`.

### Added

- Standalone TextMate grammar (no dependency on Remote-SSH or any other extension).
- File detection by filename, glob pattern, and first-line content, plus a command to set the language mode manually.
- Real keyword autocompletion for all SSH directives, plus Host and Tunnel block snippets.
- Configurable keyword linter with "did you mean …?" suggestions (`ssh-config-toolkit.lint.*`).
- Document links for `Include`, `IdentityFile`, `CertificateFile`, and `UserKnownHostsFile`.

### Fixed

- "Open User Configuration" now uses the OS home directory instead of the Windows-only `USERPROFILE` variable, so it works on macOS and Linux.
- Removed the hard `extensionDependency` on `ms-vscode-remote.remote-ssh`; the extension now defines its own language and activates on its own.
- Path links now resolve `~`, absolute, and relative paths correctly and skip globs.
