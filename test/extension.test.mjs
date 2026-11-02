// The built bundle (dist/extension.cjs) activates against a stand-in `vscode` module and wires the engine to every
// provider: a stale binding is diagnosed, lensed and fixable; hover, outline, folding, completion and format answer.
// Fixture: the @rederive/colors `strip` family (primary + js language file + oracle). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = new URL('..', import.meta.url).pathname;
const FIX = join(ROOT, 'test/fixtures/colors/sir');

function load(text) {
  const d = mkdtempSync(join(tmpdir(), 'vscode-sir-')); mkdirSync(join(d, 'node_modules/vscode'), { recursive: true });
  copyFileSync(join(ROOT, 'dist/extension.cjs'), join(d, 'extension.cjs'));
  writeFileSync(join(d, 'node_modules/vscode/index.js'), MOCK); const req = createRequire(join(d, 'x.js'));
  const vs = req('vscode'); const path = join(FIX, 'strip.js.sir');
  vs.__doc = { uri: { fsPath: path, scheme: 'file' }, languageId: 'sir', fileName: path, getText: () => text, lineCount: text.split('\n').length };
  vs.workspace.textDocuments = [vs.__doc]; req('./extension.cjs').activate({ subscriptions: [] }); return vs;
}

test('a stale binding is diagnosed, lensed and offered a re-bind', () => {
  const vs = load(readFileSync(join(FIX, 'strip.js.sir'), 'utf8').replace(/PRIMARY-SHA256 \w+/, 'PRIMARY-SHA256 ' + 'a'.repeat(64)));
  const diags = Object.values(vs.__set)[0]; assert.deepEqual(diags.map((d) => d.code), ['E_STALE_BINDING']);
  assert.match(vs.__reg.CodeLens.provideCodeLenses(vs.__doc)[0].command.title, /^\$\(error\) stale/);
  assert.match(vs.__reg.CodeActions.provideCodeActions(vs.__doc, null, { diagnostics: diags })[0].title, /^Re-bind to strip\.sir/);
});

test('a bound file is clean and every provider answers', () => {
  const vs = load(readFileSync(join(FIX, 'strip.js.sir'), 'utf8')); const r = vs.__reg, d = vs.__doc;
  assert.deepEqual(Object.values(vs.__set)[0], []);
  assert.match(r.CodeLens.provideCodeLenses(d)[0].command.title, /^\$\(pass\) bound to strip\.sir/);
  assert.match(r.Hover.provideHover(d, { line: 0, character: 1 }).contents.value, /^\*\*UNIT\*\*/);
  assert.ok(r.DocumentSymbol.provideDocumentSymbols(d).length > 5);
  assert.ok(r.FoldingRange.provideFoldingRanges(d).length > 0);
  assert.ok(r.CompletionItem.provideCompletionItems(d, { line: 0, character: 0 }).some((c) => c.label === 'MECHANISM'));
  assert.deepEqual(r.DocumentFormattingEdit.provideDocumentFormattingEdits(d), []);
});

const MOCK = `
const noop = () => ({ dispose() {} });
class Position { constructor(l, c) { this.line = l; this.character = c; } }
class Range { constructor(a, b, c, d) { if (a instanceof Position) { this.start = a; this.end = b; } else { this.start = new Position(a, b); this.end = new Position(c, d); } } }
const reg = {}, set = {};
module.exports = {
  Position, Range, Diagnostic: class { constructor(r, m, s) { Object.assign(this, { range: r, message: m, severity: s }); } },
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 }, DiagnosticTag: { Deprecated: 2 },
  MarkdownString: class { constructor(v) { this.value = v; } }, Hover: class { constructor(c, r) { this.contents = c; this.range = r; } },
  Location: class { constructor(u, r) { this.uri = u; this.range = r; } }, DocumentSymbol: class { constructor(n, d, k) { Object.assign(this, { name: n, detail: d, kind: k }); } },
  FoldingRange: class { constructor(s, e, k) { Object.assign(this, { s, e, k }); } }, FoldingRangeKind: { Comment: 1 },
  CompletionItem: class { constructor(l, k) { this.label = l; this.kind = k; } }, SnippetString: class { constructor(v) { this.value = v; } },
  TextEdit: { replace: (r, t) => ({ r, t }) }, CodeAction: class { constructor(t) { this.title = t; } }, CodeActionKind: { QuickFix: 'quickfix' },
  WorkspaceEdit: class { replace() {} }, CodeLens: class { constructor(r, c) { this.range = r; this.command = c; } },
  EventEmitter: class { constructor() { this.event = noop; } fire() {} dispose() {} }, Uri: { file: (p) => ({ fsPath: p }) },
  languages: { createDiagnosticCollection: () => ({ set: (u, d) => (set[u.fsPath] = d), delete() {}, dispose() {} }),
    ...Object.fromEntries(['Hover', 'Definition', 'Reference', 'DocumentSymbol', 'FoldingRange', 'CompletionItem', 'DocumentFormattingEdit', 'CodeActions', 'CodeLens'].map((k) => ['register' + k + 'Provider', (s, p) => { reg[k] = p; return { dispose() {} }; }])) },
  workspace: { textDocuments: [], getConfiguration: () => ({ get: (k, d) => d }), onDidOpenTextDocument: noop, onDidChangeTextDocument: noop, onDidCloseTextDocument: noop,
    onDidChangeConfiguration: noop, createFileSystemWatcher: () => ({ onDidChange: noop, onDidCreate: noop, onDidDelete: noop, dispose() {} }) },
  commands: { registerCommand: noop }, window: {}, env: {}, __reg: reg, __set: set,
};`;
