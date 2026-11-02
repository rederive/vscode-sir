// The SIR extension for VS Code: the TextMate grammar colors the register; this file wires rdv's own analysis engine
// (rederive's cli/lsp/analyze.mjs from the `rederive` npm package, bundled in — the same one `rdv lsp` serves to other editors) into VS Code's native providers.
// No language-client dependency and nothing downloaded at run time: the bundle is the engine plus this adapter.
import * as vscode from 'vscode';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import * as A from 'rederive/cli/lsp/analyze.mjs';

const SEL = { language: 'sir' };
const P = (p) => new vscode.Position(p.line, p.character);
const R = (r) => new vscode.Range(P(r.start), P(r.end));
const SEV = { 1: vscode.DiagnosticSeverity.Error, 2: vscode.DiagnosticSeverity.Warning, 3: vscode.DiagnosticSeverity.Information, 4: vscode.DiagnosticSeverity.Hint };
const md = (c) => { const m = new vscode.MarkdownString(c.value); m.supportHtml = false; return m; };

function ctx() {
  const open = new Map(vscode.workspace.textDocuments.filter((d) => d.uri.scheme === 'file').map((d) => [d.uri.fsPath, d]));
  return { mode: vscode.workspace.getConfiguration('sir').get('validation.mode', 'auto'),
    read: (p) => (open.has(p) ? open.get(p).getText() : existsSync(p) ? readFileSync(p, 'utf8') : null),
    list: (d) => { try { return readdirSync(d); } catch { return []; } } };
}
const args = (doc) => [doc.uri.fsPath, doc.getText(), ctx()];

export function activate(context) {
  const diags = vscode.languages.createDiagnosticCollection('sir'); context.subscriptions.push(diags);
  const lensChanged = new vscode.EventEmitter(); context.subscriptions.push(lensChanged);
  const refresh = (doc) => { if (doc.languageId !== 'sir' || doc.uri.scheme !== 'file') return;
    try { diags.set(doc.uri, A.diagnostics(...args(doc)).map((d) => { const x = new vscode.Diagnostic(R(d.range), d.message, SEV[d.severity]); x.code = d.code; x.source = 'rdv'; if (d.tags) x.tags = d.tags.map(() => vscode.DiagnosticTag.Deprecated); x.data = d.data; x.raw = d; return x; })); }
    catch (e) { diags.set(doc.uri, [new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), `SIR: ${e.message}`, vscode.DiagnosticSeverity.Error)]); } };
  // a change anywhere in a package moves its neighbours: a primary edit re-binds (or stales) its language files, an oracle
  // edit moves the primary's ORACLE line — so every open SIR file under the same package root is re-checked
  const rootOf = (p) => { const d = dirname(p); return basename(d) === 'sir' || basename(d) === 'oracles' || basename(d) === 'carried' ? dirname(d) : d; };
  const refreshAround = (p) => { const root = rootOf(p); for (const d of vscode.workspace.textDocuments) if (d.languageId === 'sir' && (rootOf(d.uri.fsPath) === root || dirname(d.uri.fsPath) === dirname(p))) refresh(d); lensChanged.fire(); };
  let timer = null; const soon = (p) => { clearTimeout(timer); timer = setTimeout(() => refreshAround(p), 150); };
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((d) => { refresh(d); if (d.languageId === 'sir') soon(d.uri.fsPath); }),
    vscode.workspace.onDidChangeTextDocument((e) => { if (e.document.languageId === 'sir' || /\.json$/.test(e.document.fileName)) soon(e.document.uri.fsPath); }),
    vscode.workspace.onDidCloseTextDocument((d) => { if (d.languageId === 'sir') diags.delete(d.uri); }),
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration('sir')) { for (const d of vscode.workspace.textDocuments) refresh(d); lensChanged.fire(); } }),
  );
  const watcher = vscode.workspace.createFileSystemWatcher('**/{*.sir,oracles/*.json,carried/*}'); context.subscriptions.push(watcher);
  for (const ev of [watcher.onDidChange, watcher.onDidCreate, watcher.onDidDelete]) context.subscriptions.push(ev((u) => soon(u.fsPath)));
  vscode.workspace.textDocuments.forEach(refresh);

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(SEL, { provideHover: (doc, pos) => { const h = A.hover(...args(doc).slice(0, 2), { line: pos.line, character: pos.character }, ctx()); return h ? new vscode.Hover(md(h.contents), h.range ? R(h.range) : undefined) : null; } }),
    vscode.languages.registerDefinitionProvider(SEL, { provideDefinition: (doc, pos) => A.definition(doc.uri.fsPath, doc.getText(), pos, ctx()).map((x) => new vscode.Location(vscode.Uri.file(x.path), new vscode.Position(x.line, x.character))) }),
    vscode.languages.registerReferenceProvider(SEL, { provideReferences: (doc, pos) => A.references(doc.uri.fsPath, doc.getText(), pos, ctx()).map((x) => new vscode.Location(vscode.Uri.file(x.path), new vscode.Range(x.line, x.character, x.line, x.endCharacter))) }),
    vscode.languages.registerDocumentSymbolProvider(SEL, { provideDocumentSymbols: (doc) => { const conv = (s) => { const x = new vscode.DocumentSymbol(s.name, s.detail, s.kind - 1, R(s.range), R(s.selectionRange)); x.children = s.children.map(conv); return x; }; return A.documentSymbols(...args(doc)).map(conv); } }),
    vscode.languages.registerFoldingRangeProvider(SEL, { provideFoldingRanges: (doc) => A.foldingRanges(...args(doc)).map((f) => new vscode.FoldingRange(f.startLine, f.endLine, f.kind === 'comment' ? vscode.FoldingRangeKind.Comment : undefined)) }),
    vscode.languages.registerCompletionItemProvider(SEL, { provideCompletionItems: (doc, pos) => A.completion(doc.uri.fsPath, doc.getText(), pos, ctx()).map((c) => { const x = new vscode.CompletionItem(c.label, c.kind - 1); x.detail = c.detail; if (c.documentation) x.documentation = md(c.documentation);
      if (c.insertText) x.insertText = c.insertTextFormat === 2 ? new vscode.SnippetString(c.insertText) : c.insertText; if (c.sortText) x.sortText = c.sortText; return x; }) }, ' ', ':', '[', '|', ','),
    vscode.languages.registerDocumentFormattingEditProvider(SEL, { provideDocumentFormattingEdits: (doc) => { const f = A.format(doc.getText()); return f === null ? [] : [vscode.TextEdit.replace(new vscode.Range(0, 0, doc.lineCount, 0), f)]; } }),
    vscode.languages.registerCodeActionsProvider(SEL, { provideCodeActions: (doc, _range, cc) => {
      const raw = cc.diagnostics.filter((d) => d.source === 'rdv').map((d) => ({ code: d.code, range: { start: d.range.start, end: d.range.end }, data: d.data, _d: d }));
      return A.codeActions(...args(doc).slice(0, 2), raw, ctx()).map((a) => { const x = new vscode.CodeAction(a.title, vscode.CodeActionKind.QuickFix); x.diagnostics = [a.diagnostic._d]; x.edit = new vscode.WorkspaceEdit(); for (const e of a.edits) x.edit.replace(doc.uri, R(e.range), e.newText); return x; }); } }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
    vscode.languages.registerCodeLensProvider(SEL, { onDidChangeCodeLenses: lensChanged.event, provideCodeLenses: (doc) => {
      if (!vscode.workspace.getConfiguration('sir').get('codeLens.enabled', true)) return [];
      return A.codeLenses(...args(doc)).map((l) => new vscode.CodeLens(new vscode.Range(l.line, 0, l.line, 0), { title: `${l.ok ? '$(pass)' : l.ok === false ? '$(error)' : '$(info)'} ${l.title.replace(/^[✓✗] /, '')}`, command: l.command ? 'sir.open' : '', arguments: l.arguments ?? [] })); } }),

    vscode.commands.registerCommand('sir.open', async (...paths) => {
      const pick = paths.length > 1 ? await vscode.window.showQuickPick(paths.map((p) => ({ label: basename(p), description: dirname(p), p })), { placeHolder: 'Open a file of this unit' }) : { p: paths[0] };
      if (pick?.p) await vscode.window.showTextDocument(vscode.Uri.file(pick.p), { preview: true }); }),
    vscode.commands.registerCommand('sir.check', () => {
      const ed = vscode.window.activeTextEditor; if (!ed) return vscode.window.showInformationMessage('Open a file inside a rederive package first.');
      let d = dirname(ed.document.uri.fsPath); while (d !== dirname(d) && !existsSync(join(d, 'sir.manifest.json'))) d = dirname(d);
      if (!existsSync(join(d, 'sir.manifest.json'))) return vscode.window.showWarningMessage('No sir.manifest.json above this file: rdv check verifies a rederive package (sir/, oracles/, src/).');
      const langs = vscode.workspace.getConfiguration('sir').get('check.languages', '');
      const t = vscode.window.createTerminal({ name: 'rdv check', cwd: d }); t.show(); t.sendText(`npx -p rederive rdv check .${langs ? ` --lang ${langs}` : ''}`); }),
    vscode.commands.registerCommand('sir.copyPrimaryHash', async () => {
      const ed = vscode.window.activeTextEditor; if (!ed || ed.document.languageId !== 'sir') return;
      const doc = A.load(ed.document.uri.fsPath, ed.document.getText(), ctx()); const t = doc.role === 'primary' ? ed.document.getText() : ctx().read(doc.primaryPath);
      if (t === null) return vscode.window.showWarningMessage(`${doc.unit}.sir is not beside this file.`);
      const b = A.bindingOf('', t); await vscode.env.clipboard.writeText(b.primarySha); vscode.window.showInformationMessage(`Copied ${doc.unit}.sir's PRIMARY-SHA256: ${b.primarySha.slice(0, 12)}…`); }),
  );
}
export function deactivate() {}
