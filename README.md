# SIR for VS Code

Read and write [SIR](https://github.com/rederive/sir-spec) contracts, the language-neutral specs that
[rederive](https://rederive.ai) checks code against, with **rdv's own checks as you type**.

The extension bundles the same analysis engine that `rdv check` and `rdv lsp` run, so it never gives a second opinion.
Anything underlined here, rdv would refuse too.

## What you get

**Colors that follow the register.** You see the structure before you read a word.

| what | examples |
|---|---|
| header and identity | `UNIT get_rgb`, `KIND FUNCTIONAL`, `FIDELITY spec`, `LANG rust`, `PRIMARY-SHA256 …` |
| the contract | `SIG`, `ENVELOPE`, `DEPENDS-ON`, `BEHAVIOR`, `TABLE` |
| rules | `R1 … Rn` |
| pins | `PINNED regex HEX6 = /…/i CITED R3` |
| carried data and oracle | `CARRIED`, `SHAPE`, `CANONICAL-SHA256`, `AUTHORITY`, `ORACLE` |
| language-file ABI | `ABI`, `MECHANISM` |
| citations | `CITED`, `EARNED`, `ANCHOR` |
| prose (not graded) | `DESCRIPTION`, `PROVENANCE`, `INVARIANT`, `SCOPE`, and `NOTE` blocks, dimmed |

**Live checks.**
- Strict v0.5 register errors: `#` comments, unindented continuations, unknown or pseudocode directives, and a directive
  in the wrong file.
- Uncited pins.
- Language leaks: JS or Rust API names in a primary, or behavior in a language file.
- Carried data declared as a dependency.
- Code-shaped lines in a primary.

**Bindings and oracles.**
- Edit a primary and every language file bound to it turns **STALE** right away.
- The `ORACLE` line is checked against the oracle file's own hash and its vectors.
- Lenses above `UNIT`, `PRIMARY-SHA256` and `ORACLE` show the state:

```
bindings: js ✓ · rust ✓ · ts ✓
UNIT strip
…
✓ oracle: 9 frozen + 8 held-out · hash matches
ORACLE value -> oracles/strip.json  CANONICAL-SHA256 3031c4ef…
```

**Navigation.**
- Hover a directive for its meaning, linked to the spec.
- Hover `R3`, even inside `R1-R4`, to read the rule from the primary and see every line in the family that names it.
- Go to definition jumps from a rule, `PRIMARY-SHA256` or `ORACLE` to the right file.
- Find references works on any rule.
- The outline nests the rules under `BEHAVIOR`.

**Writing.**
- Completion offers the directives your file's register allows, the values for `KIND`, `FIDELITY`, `ORACLE-CLASS` and
  `LANG`, abstract types in a `SIG`, and rule names after `CITED`.
- Completing `PRIMARY-SHA256` fills in the primary's current hash.
- **Format Document** writes the binding normal form, so a format can never stale a binding.

**Quick fixes.**
- Re-bind a stale language file, after you've reviewed it against the primary.
- Drop a legacy `NAME:` colon.
- Turn a `#` comment into a `NOTE`.
- An oracle hash that disagrees is never offered a fix, because that is a finding, not a typo.

## Commands

- **SIR: Check this package with rdv** runs `npx -p rederive rdv check` on the package around the open file, in a terminal.
- **SIR: Copy the primary's PRIMARY-SHA256**

## Settings

| setting | default | |
|---|---|---|
| `sir.validation.mode` | `auto` | `auto` holds a v0.5 family to the strict register and reads a lone pre-v0.5 primary as legacy. The other values are `strict` and `legacy`. |
| `sir.codeLens.enabled` | `true` | the binding and oracle lenses |
| `sir.check.languages` | `""` | `--lang` for the check command, e.g. `js` |

## Other editors

The same engine runs as a standard language server: `npm i -g rederive`, then `rdv lsp --stdio`. Setup for Neovim, Helix,
Emacs and Sublime is in [rederive's editors/README.md](https://github.com/rederive/rederive/blob/main/editors/README.md).

## Development

The analysis engine is not in this repo. It is `cli/lsp/analyze.mjs` in [rederive](https://github.com/rederive/rederive),
installed from npm and bundled in at build time, so `rdv check`, `rdv lsp` and this extension can't drift apart. This
repo holds the VS Code side: the TextMate grammar, the adapter (`src/extension.mjs`) and packaging.

```sh
npm install
npm test               # builds dist/extension.cjs and runs it against a stand-in vscode module
npm run package        # → sir-lang-<version>.vsix (no packaging dependency; Node ≥ 22.2)
code --install-extension sir-lang-<version>.vsix
```

When the SIR vocabulary changes (`DIRECTIVES` in rederive's `cli/sir/sir-parse.mjs`), update
`syntaxes/sir.tmLanguage.json` to match.

Apache-2.0. Made by Apilify Inc. for the rederive project.
