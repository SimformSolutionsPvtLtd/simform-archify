import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  findPackIcon,
  inspectIconSvg,
  listPackIcons,
  loadIconCatalog,
  namespaceSvgIds,
  suggestPackIcons,
} from '../archify/renderers/shared/icon-packs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '..', 'archify');
const cli = path.join(skillRoot, 'bin', 'archify.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-icon-packs-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

function diagram(nodes, extra = {}) {
  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: { title: 'Icon pack test', output: 'out.html', quality_profile: 'showcase' },
    components: nodes,
    connections: [],
    ...extra,
  };
}

test('catalogue is complete and every icon file matches its digest', () => {
  const result = spawnSync(process.execPath, [path.join(skillRoot, 'scripts', 'sync-icon-packs.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const { icons, packs } = loadIconCatalog();
  assert.deepEqual(Object.keys(packs).sort(), ['azure', 'd365', 'entra', 'fabric', 'm365']);
  for (const pack of Object.keys(packs)) {
    assert.ok(icons.some((icon) => icon.pack === pack), `${pack} has icons`);
    assert.ok(packs[pack].page.startsWith('https://learn.microsoft.com/'), `${pack} records its official page`);
  }
  assert.ok(icons.length > 1000);
});

test('common Azure service names resolve to the right icon', () => {
  const expected = {
    'app service': 'azure-app-services',
    AKS: 'azure-kubernetes-services',
    'Azure SQL': 'azure-sql-database',
    'front door': 'azure-front-door-and-cdn-profiles',
    'Key Vault': 'azure-key-vaults',
    'cosmos db': 'azure-cosmos-db',
    'service bus': 'azure-service-bus',
    functions: 'azure-function-apps',
    entra: 'entra-id',
    'power bi': 'fabric-power-bi',
    'azure-openai': 'azure-openai',
  };
  for (const [query, id] of Object.entries(expected)) {
    assert.equal(findPackIcon(query)?.id, id, query);
  }
  assert.equal(findPackIcon('not-a-real-service'), null);
  assert.ok(suggestPackIcons('storage blob').length > 0);
  assert.ok(listPackIcons('redis').some((icon) => icon.id === 'azure-cache-redis'));
});

test('the brands command lists pack icons next to the built-in marks', () => {
  const result = run(['brands', 'key vault', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const marks = JSON.parse(result.stdout).marks;
  assert.ok(marks.some((mark) => mark.id === 'azure-key-vaults' && mark.category.startsWith('azure/')));
});

test('icon safety check rejects scripts, external references and styles', () => {
  const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18">${body}</svg>`;
  assert.equal(inspectIconSvg(wrap('<path d="M0 0h18v18z"/>')).ok, true);
  const rejected = [
    wrap('<script>alert(1)</script>'),
    wrap('<foreignObject><div/></foreignObject>'),
    wrap('<path d="M0 0" onclick="x()"/>'),
    wrap('<image href="https://example.com/a.png"/>'),
    wrap('<style>.a{fill:red}</style><path d="M0 0"/>'),
    wrap('<rect fill="url(https://example.com/x#g)"/>'),
    wrap('<a href="javascript:alert(1)"><path d="M0 0"/></a>'),
    '<!DOCTYPE svg><svg viewBox="0 0 1 1"><path d="M0 0"/></svg>',
    '<svg><path d="M0 0"/></svg>',
  ];
  for (const text of rejected) assert.equal(inspectIconSvg(text).ok, false, text.slice(0, 60));
});

test('gradient ids are namespaced so repeated inlining cannot collide', () => {
  const markup = '<defs><linearGradient id="a1"/></defs><path fill="url(#a1)"/><use href="#a1"/>';
  const namespaced = namespaceSvgIds(markup, 'p1-');
  assert.equal(namespaced, '<defs><linearGradient id="p1-a1"/></defs><path fill="url(#p1-a1)"/><use href="#p1-a1"/>');
});

test('an Azure icon renders once per node as unmodified, uniquely-id\'d artwork inside the single diagram svg', () => {
  const input = path.join(tmp, 'azure.architecture.json');
  const output = path.join(tmp, 'azure.html');
  fs.writeFileSync(input, JSON.stringify(diagram([
    { id: 'kv1', type: 'security', label: 'Key Vault', brand: 'key vault', pos: [40, 40], size: [170, 68] },
    { id: 'kv2', type: 'security', label: 'Key Vault', brand: 'azure-key-vaults', pos: [300, 40], size: [170, 68] },
    { id: 'app', type: 'backend', label: 'App Service', brand: 'app service', pos: [560, 40], size: [170, 68] },
    { id: 'plain', type: 'external', label: 'Users', pos: [40, 200], size: [130, 60] },
  ])));
  const result = run(['render', 'architecture', input, output, '--quality', 'showcase']);
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(output, 'utf8');
  assert.equal((html.match(/data-brand-pack="azure"/g) || []).length, 3);
  assert.equal((html.match(/class="brand-mark-pack-art"/g) || []).length, 3);
  assert.match(html, /data-brand-mark="azure-key-vaults"/);
  assert.match(html, /data-brand-mark="azure-app-services"/);
  assert.match(html, /data-brand-source="https:\/\/learn\.microsoft\.com\/en-us\/azure\/architecture\/icons\/"/);
  assert.equal((html.match(/<svg[\s>]/g) || []).length, 1, 'delivered artifact keeps exactly one diagram <svg>');
  const gradientIds = [...html.matchAll(/<(?:linear|radial)Gradient[^>]* id="(ic[0-9a-f]{8}-[^"]+)"/g)].map((match) => match[1]);
  assert.ok(gradientIds.length > 0, 'icons carry gradients');
  assert.equal(new Set(gradientIds).size, gradientIds.length, 'every gradient id is unique');
  for (const id of gradientIds.slice(0, 5)) assert.ok(html.includes(`url(#${id})`), `${id} is referenced`);
  // Rendering is deterministic: the same input yields the same bytes.
  const again = path.join(tmp, 'azure-again.html');
  assert.equal(run(['render', 'architecture', input, again, '--quality', 'showcase']).status, 0);
  assert.equal(fs.readFileSync(again, 'utf8'), html);
});

test('pack icon artwork in the artifact equals the shipped file', () => {
  const icon = findPackIcon('key vault');
  const source = fs.readFileSync(path.join(skillRoot, 'icon-packs', icon.file), 'utf8');
  const paths = [...source.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(paths.length > 0);
  const input = path.join(tmp, 'single.architecture.json');
  const output = path.join(tmp, 'single.html');
  fs.writeFileSync(input, JSON.stringify(diagram([{ id: 'kv', type: 'security', label: 'Key Vault', brand: icon.id, pos: [40, 40], size: [170, 68] }])));
  assert.equal(run(['render', 'architecture', input, output, '--quality', 'showcase']).status, 0);
  const html = fs.readFileSync(output, 'utf8');
  for (const d of paths) assert.ok(html.includes(`d="${d}"`), 'path data is byte-identical to the Microsoft original');
});

test('an unknown service reports close icon ids instead of inventing one', () => {
  const input = path.join(tmp, 'unknown.architecture.json');
  fs.writeFileSync(input, JSON.stringify(diagram([{ id: 'x', type: 'cloud', label: 'Mystery', brand: 'azure key vaullt', pos: [40, 40], size: [170, 68] }])));
  const result = run(['validate', 'architecture', input, '--quality', 'showcase']);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /not a built-in brand; closest IDs:.*azure-key-vaults/);
});

test('a node too narrow for the larger pack icon is reported, not silently clipped', () => {
  const input = path.join(tmp, 'narrow.architecture.json');
  fs.writeFileSync(input, JSON.stringify(diagram([{ id: 'x', type: 'cloud', label: 'Application Gateway', brand: 'app gateway', pos: [40, 40], size: [100, 60] }])));
  const result = run(['validate', 'architecture', input, '--quality', 'showcase']);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /brand top rail/);
});
