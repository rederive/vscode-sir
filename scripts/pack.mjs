// node scripts/pack.mjs — zips this folder into sir-lang-<version>.vsix with no packaging dependency: a .vsix is an OPC zip
// ([Content_Types].xml + extension.vsixmanifest + extension/…). Install: code --install-extension sir-lang-<version>.vsix
// The Marketplace and Open VSX accept the same file (`npx @vscode/vsce publish --packagePath …`, `npx ovsx publish …`).
// Needs Node >= 22.2 (zlib.crc32); run `npm run build` first (or `npm run package`, which does both).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FILES = ['package.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'icon.png', 'language-configuration.json', 'syntaxes/sir.tmLanguage.json', 'syntaxes/sir.markdown.tmLanguage.json', 'dist/extension.cjs'];
for (const f of FILES) if (!existsSync(join(HERE, f))) { console.error(`missing ${f}${f.startsWith('dist/') ? ' — run npm run build' : ''}`); process.exit(1); }
const target = (f) => 'extension/' + (f === 'LICENSE' ? 'LICENSE.txt' : f);   // an OPC part needs an extension with a declared content type
const repo = pkg.repository.url.replace(/\.git$/, '');
const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${esc(pkg.name)}" Version="${esc(pkg.version)}" Publisher="${esc(pkg.publisher)}"/>
    <DisplayName>${esc(pkg.displayName)}</DisplayName>
    <Description xml:space="preserve">${esc(pkg.description)}</Description>
    <Tags>${esc(pkg.keywords.join(','))},__ext_sir</Tags>
    <Categories>${esc(pkg.categories.join(','))}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${esc(pkg.engines.vscode)}"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/>
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value=""/>
      <Property Id="Microsoft.VisualStudio.Services.Links.Source" Value="${esc(repo)}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.Getstarted" Value="${esc(repo)}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.GitHub" Value="${esc(repo)}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.Support" Value="${esc(pkg.bugs.url)}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.Learn" Value="${esc(pkg.homepage)}"/>
      <Property Id="Microsoft.VisualStudio.Services.Branding.Color" Value="${esc(pkg.galleryBanner.color)}"/>
      <Property Id="Microsoft.VisualStudio.Services.Branding.Theme" Value="${esc(pkg.galleryBanner.theme)}"/>
      <Property Id="Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown" Value="true"/>
      <Property Id="Microsoft.VisualStudio.Services.Content.Pricing" Value="Free"/>
    </Properties>
    <License>extension/LICENSE.txt</License>
    <Icon>extension/icon.png</Icon>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.txt" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true"/>
  </Assets>
</PackageManifest>
`;
const types = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json"/><Default Extension=".md" ContentType="text/markdown"/><Default Extension=".txt" ContentType="text/plain"/><Default Extension=".png" ContentType="image/png"/><Default Extension=".cjs" ContentType="application/javascript"/><Default Extension=".vsixmanifest" ContentType="text/xml"/></Types>
`;
// a minimal zip: deflated entries, a central directory, the end record. Fixed timestamp → a reproducible archive.
const entries = [['[Content_Types].xml', Buffer.from(types)], ['extension.vsixmanifest', Buffer.from(manifest)], ...FILES.map((f) => [target(f), readFileSync(join(HERE, f))])];
const local = [], central = []; let offset = 0;
const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1;
for (const [name, data] of entries) {
  const n = Buffer.from(name, 'utf8'), z = deflateRawSync(data, { level: 9 }), crc = crc32(data);
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(DOS_TIME, 10); h.writeUInt16LE(DOS_DATE, 12);
  h.writeUInt32LE(crc, 14); h.writeUInt32LE(z.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
  const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(DOS_TIME, 12); c.writeUInt16LE(DOS_DATE, 14);
  c.writeUInt32LE(crc, 16); c.writeUInt32LE(z.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
  local.push(h, n, z); central.push(c, n); offset += 30 + n.length + z.length;
}
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
const out = join(HERE, `${pkg.name}-${pkg.version}.vsix`);
writeFileSync(out, Buffer.concat([...local, cd, end]));
console.log(out);
