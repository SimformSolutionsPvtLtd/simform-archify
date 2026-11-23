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
  assert.deepEqual(Object.keys(packs).sort(), ['ai', 'azure', 'd365', 'entra', 'fabric', 'generic', 'm365']);
  for (const pack of Object.keys(packs)) {
    assert.ok(icons.some((icon) => icon.pack === pack), `${pack} has icons`);
    const official = pack === 'generic' ? 'https://lucide.dev/' : (pack === 'ai' ? 'https://lobehub.com/' : 'https://learn.microsoft.com/');
    assert.ok(packs[pack].page.startsWith(official), `${pack} records its official page`);
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
  // Three Azure icons, plus the generic users icon inferred for the plain node.
  assert.equal((html.match(/class="brand-mark-pack-art"/g) || []).length, 4);
  assert.equal((html.match(/data-brand-pack="generic"/g) || []).length, 1);
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

test('generic icons resolve by plain component names and keep Microsoft names for Azure', () => {
  assert.equal(findPackIcon('queue').id, 'generic-queue');
  assert.equal(findPackIcon('api server').id, 'generic-api-server');
  assert.equal(findPackIcon('browser').id, 'generic-browser');
  assert.equal(findPackIcon('worker').id, 'generic-worker');
  assert.equal(findPackIcon('azure-storage-queue').pack, 'azure');
  assert.equal(findPackIcon('app service').pack, 'azure');
  assert.ok(listPackIcons('generic').filter((icon) => icon.pack === 'generic').length >= 40);
});

test('a generic icon is line art in the node colour, not Microsoft artwork', () => {
  const input = path.join(tmp, 'generic.architecture.json');
  const output = path.join(tmp, 'generic.html');
  fs.writeFileSync(input, JSON.stringify(diagram([
    { id: 'q', type: 'messagebus', label: 'Job queue', brand: 'queue', pos: [40, 40], size: [210, 76] },
  ])));
  assert.equal(run(['render', 'architecture', input, output, '--quality', 'showcase']).status, 0);
  const html = fs.readFileSync(output, 'utf8');
  assert.match(html, /class="brand-mark brand-mark-line s-messagebus"/);
  assert.match(html, /data-brand-pack="generic"/);
  assert.match(html, /stroke="currentColor" stroke-width="1\.75"/);
});

test('nodes without a brand get an inferred generic icon only beside Microsoft icons', () => {
  const nodes = [
    { id: 'kv', type: 'security', label: 'Key Vault', brand: 'key vault', pos: [40, 40], size: [210, 76] },
    { id: 'jobs', type: 'messagebus', label: 'Job queue', pos: [340, 40], size: [210, 76] },
    { id: 'cdn', type: 'cloud', label: 'Edge', pos: [640, 40], size: [210, 76] },
    { id: 'tiny', type: 'backend', label: 'Worker', pos: [40, 200], size: [90, 60] },
  ];
  const input = path.join(tmp, 'infer.architecture.json');
  const output = path.join(tmp, 'infer.html');
  fs.writeFileSync(input, JSON.stringify(diagram(nodes)));
  assert.equal(run(['render', 'architecture', input, output, '--quality', 'showcase']).status, 0);
  const html = fs.readFileSync(output, 'utf8');
  assert.match(html, /data-brand-mark="generic-queue"/);
  assert.match(html, /data-brand-mark="generic-cloud-service"/, 'type fallback when no word matches');
  assert.doesNotMatch(html, /data-brand-mark="generic-worker"/, 'a node too narrow for an icon keeps none');

  const alone = path.join(tmp, 'alone.architecture.json');
  const aloneOut = path.join(tmp, 'alone.html');
  fs.writeFileSync(alone, JSON.stringify(diagram(nodes.slice(1, 3))));
  assert.equal(run(['render', 'architecture', alone, aloneOut, '--quality', 'showcase']).status, 0);
  assert.doesNotMatch(fs.readFileSync(aloneOut, 'utf8'), /data-brand-pack/, 'no icons are added when the diagram uses none');
});

test('SIMFORM_GENERIC_ICONS=off switches the inference off', () => {
  const input = path.join(tmp, 'off.architecture.json');
  const output = path.join(tmp, 'off.html');
  fs.writeFileSync(input, JSON.stringify(diagram([
    { id: 'kv', type: 'security', label: 'Key Vault', brand: 'key vault', pos: [40, 40], size: [210, 76] },
    { id: 'jobs', type: 'messagebus', label: 'Job queue', pos: [340, 40], size: [210, 76] },
  ])));
  const result = spawnSync(process.execPath, [cli, 'render', 'architecture', input, output, '--quality', 'showcase'], {
    encoding: 'utf8',
    env: { ...process.env, SIMFORM_GENERIC_ICONS: 'off' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(fs.readFileSync(output, 'utf8'), /data-brand-pack="generic"/);
});

test('AI and data stack names resolve to built-in marks, and Microsoft Agent Framework to the generic agent icon', () => {
  const brands = (query) => run(['brands', query, '--json']);
  for (const [query, id] of [['qdrant', 'qdrant'], ['langchain', 'langchain'], ['llamaindex', 'llamaindex'], ['agno', 'agno'], ['postgresql', 'postgresql'], ['redis', 'redis'], ['react', 'react'], ['python', 'python'], ['typescript', 'typescript'], ['mongodb', 'mongodb']]) {
    const result = brands(query);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`"${id}"`), `${query} resolves to ${id}`);
  }
  assert.equal(findPackIcon('microsoft agent framework').id, 'generic-agent');
  assert.equal(findPackIcon('vector store').id, 'generic-vector-database');
});

test('built-in marks use the 48px gutter in architecture diagrams and fall back to the small badge on a narrow node', () => {
  const input = path.join(tmp, 'brands-gutter.architecture.json');
  const output = path.join(tmp, 'brands-gutter.html');
  fs.writeFileSync(input, JSON.stringify(diagram([
    { id: 'wide', type: 'database', label: 'Qdrant', brand: 'qdrant', pos: [40, 40], size: [210, 76] },
    { id: 'narrow', type: 'database', label: 'PostgreSQL', brand: 'postgresql', pos: [340, 40], size: [100, 60] },
  ])));
  const result = run(['render', 'architecture', input, output, '--quality', 'showcase']);
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(output, 'utf8');
  const badge = (id) => html.match(new RegExp(`data-brand-mark="${id}"[^>]+>\\s*<rect width="([\\d.]+)"`))?.[1];
  assert.equal(badge('qdrant'), '48');
  assert.equal(badge('postgresql'), '16', 'a node too narrow for the gutter keeps the corner badge');
});

test('AI provider, vector store and framework names resolve to logos; names without a logo resolve to a generic icon', () => {
  for (const [query, id] of [
    ['bedrock', 'ai-bedrock'], ['aws bedrock', 'ai-bedrock'], ['vertex ai', 'ai-vertex-ai'], ['cohere', 'ai-cohere'], ['groq', 'ai-groq'],
    ['pinecone', 'ai-pinecone'], ['weaviate', 'ai-weaviate'], ['chromadb', 'ai-chroma'],
    ['dspy', 'ai-dspy'], ['pydantic ai', 'ai-pydantic-ai'], ['haystack', 'ai-haystack'],
    ['model context protocol', 'ai-mcp'], ['copilotkit', 'ai-copilotkit'], ['langfuse', 'ai-langfuse'],
    ['azure openai', 'azure-openai'], ['foundry', 'azure-ai-foundry'],
    ['autogen', 'generic-agent'], ['semantic kernel', 'generic-agent'], ['faiss', 'generic-vector-database'],
  ]) {
    assert.equal(findPackIcon(query)?.id, id, `${query} resolves to ${id}`);
  }
});

test('ai pack logos are drawn natively and never rely on currentColor', () => {
  const { icons } = loadIconCatalog();
  const ai = icons.filter((icon) => icon.pack === 'ai');
  assert.ok(ai.length >= 20);
  for (const icon of ai) {
    const svg = fs.readFileSync(path.join(skillRoot, 'icon-packs', icon.file), 'utf8');
    assert.doesNotMatch(svg, /currentColor/, `${icon.id} would turn white on a white tile in dark mode`);
  }
  const input = path.join(tmp, 'ai-logos.architecture.json');
  const output = path.join(tmp, 'ai-logos.html');
  fs.writeFileSync(input, JSON.stringify(diagram([
    { id: 'bedrock', type: 'external', label: 'Amazon Bedrock', brand: 'bedrock', pos: [40, 40], size: [210, 76] },
    { id: 'chroma', type: 'database', label: 'Chroma', brand: 'chroma', pos: [340, 40], size: [210, 76] },
  ])));
  const result = run(['render', 'architecture', input, output, '--quality', 'showcase']);
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(output, 'utf8');
  assert.equal((html.match(/data-brand-pack="ai"/g) || []).length, 2);
  assert.match(html, /data-brand-mark="ai-chroma"/);
});

test('the layered AI platform example groups providers and stores in labelled frames, one logo per box', () => {
  const output = path.join(tmp, 'ai-agent-platform.html');
  const result = run(['render', 'architecture', path.join(skillRoot, 'examples', 'ai-agent-platform.architecture.json'), output, '--quality', 'showcase']);
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(output, 'utf8');
  for (const layer of ['Channels', 'Edge and identity', 'Agent runtime', 'LLM providers', 'Vector stores']) {
    assert.ok(html.includes(`>${layer}<`), `${layer} frame is labelled`);
  }
  for (const id of ['openai', 'azure-ai-foundry', 'anthropic', 'ai-bedrock', 'ai-vertex-ai', 'ollama', 'qdrant', 'ai-pinecone', 'ai-weaviate', 'ai-chroma']) {
    assert.match(html, new RegExp(`data-brand-mark="${id}"`), `${id} has its own logo`);
    assert.doesNotMatch(html.match(new RegExp(`data-brand-mark="${id}"[^>]*>`))?.[0] || '', /brand-fallback/);
  }
  for (const id of ['openai', 'anthropic', 'ollama', 'qdrant']) {
    const size = html.match(new RegExp(`data-brand-mark="${id}"[^>]+>\\s*<rect width="([\\d.]+)"`))?.[1];
    assert.equal(size, '48', `${id} uses the 48px gutter, like the pack logos`);
  }
});
