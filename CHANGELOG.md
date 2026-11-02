# Changelog

## 0.2.1

- Moved to its own repo, [rederive/vscode-sir](https://github.com/rederive/vscode-sir). The engine now comes from the
  `rederive` npm package (0.5.2+) instead of a copy, so the extension and `rdv` share one implementation.

## 0.2.0

- **rdv's own checks as you type.** Every diagnostic comes from the code `rdv check` runs: the strict v0.5 register,
  unknown and misplaced directives, uncited pins, language leaks, carried data under `DEPENDS-ON`, and the code-shape
  (transcription) lint. Nothing in this extension is a second opinion.
- **Bindings and oracles, live.** A language file whose `PRIMARY-SHA256` no longer matches its primary is marked STALE the
  moment the primary changes. The primary's `ORACLE` line is checked against the oracle file's own hash and its vectors.
  Lenses above `UNIT`, `PRIMARY-SHA256` and `ORACLE` show the state at a glance.
- **Hover** shows a directive's meaning, linked to the spec section; a rule (`R2`, or `R3` inside `R1-R4`) shows its text
  from the primary and every line that names it; hashes show whether they still match.
- **Go to definition** from a rule to the primary, from `PRIMARY-SHA256` to the primary, from `ORACLE` to the oracle file.
  **Find references** lists every line in the family that names a rule.
- **Outline** with the rules nested under `BEHAVIOR`; folding per directive.
- **Completion** of directives for the file's register, values (`KIND`, `FIDELITY`, `ORACLE-CLASS`, `LANG`), abstract
  types in a `SIG`, rule names after `CITED`, and `PRIMARY-SHA256` filled with the primary's current hash.
- **Format Document** writes the binding normal form, so formatting can never stale a binding.
- **Quick fixes:** re-bind a stale language file (after you review it), drop a legacy `NAME:` colon, turn a `#` comment into a
  `NOTE`, write a legacy spelling's v0.5 name. A disagreeing oracle hash is never "fixed": it is a finding.
- `sir` code fences in Markdown are highlighted.
- The same engine runs in any LSP editor as `rdv lsp`.

## 0.1.2

- Syntax highlighting keyed to the v0.5 register.
