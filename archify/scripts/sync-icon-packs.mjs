#!/usr/bin/env node
// Simform fork: fetch, curate and index the Microsoft icon packs.
//
//   node scripts/sync-icon-packs.mjs --download [--cache-dir DIR]
//       Resolve the latest download links from the official pages, fetch the
//       five archives, extract them and rewrite icon-packs/.
//   node scripts/sync-icon-packs.mjs --from-archives DIR
//       Same, using azure.zip, m365.zip, entra.zip, fabric.zip, d365.zip in DIR.
//   node scripts/sync-icon-packs.mjs --download --only generic
//       Refresh only the named pack(s); the other packs and their catalogue
//       entries are kept as they are (no Microsoft download).
//   node scripts/sync-icon-packs.mjs --check
//       Verify icon-packs/catalog.json against the files on disk (digests,
//       sanitiser, unique ids, alias targets). No network.
//
// Curated SVGs are copied byte-for-byte. Microsoft's terms forbid altering icon
// artwork, so nothing here recolours, crops or rewrites shapes. The `generic`
// pack is different: it is Lucide (ISC licence) line art for components that are
// not Microsoft services, drawn in the node's own colour at render time.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_CATALOG_FILE, ICON_PACKS_ROOT, inspectIconSvg } from '../renderers/shared/icon-packs.mjs';
import { sameEntry } from '../renderers/shared/path-semantics.mjs';

const ALIASES_FILE = path.join(ICON_PACKS_ROOT, 'aliases.json');
const SOURCES_FILE = path.join(ICON_PACKS_ROOT, 'SOURCES.md');
// Only Microsoft's documentation, its download hosts and its official GitHub
// samples repository are ever contacted.
const ARCHIVE_ALLOWED_HOSTS = new Set([
  'learn.microsoft.com', 'arch-center.azureedge.net', 'download.microsoft.com',
  'go.microsoft.com', 'github.com', 'raw.githubusercontent.com',
  'registry.npmjs.org',
]);

const PACKS = {
  azure: {
    title: 'Azure architecture icons',
    page: 'https://learn.microsoft.com/en-us/azure/architecture/icons/',
    linkPattern: /https:\/\/arch-center\.azureedge\.net\/icons\/Azure_Public_Service_Icons_V\d+\.zip/,
    fallback: 'https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V25.zip',
    license: 'Microsoft terms: architecture diagrams, training materials and documentation only; do not alter the icons.',
    terms: [/Microsoft_Terms_of_Use\.pdf$/],
  },
  m365: {
    title: 'Microsoft 365 architecture icons',
    page: 'https://learn.microsoft.com/en-us/previous-versions/microsoft-365/solutions/architecture-icons-templates',
    linkPattern: /https:\/\/go\.microsoft\.com\/fwlink\/\?linkid=869455/,
    fallback: 'https://go.microsoft.com/fwlink/?linkid=869455',
    license: 'Microsoft terms: architecture diagrams, training materials and documentation only. Page is archived (previous-versions).',
    terms: [],
  },
  entra: {
    title: 'Microsoft Entra architecture icons',
    page: 'https://learn.microsoft.com/en-us/entra/architecture/architecture-icons',
    linkPattern: /https:\/\/download\.microsoft\.com\/download\/[^"'\s?]+Microsoft%20Entra%20architecture%20icons[^"'\s?]*\.zip/,
    fallback: 'https://download.microsoft.com/download/3/1/a/31a56038-856a-4489-88e4-ee5a1c4352be/Microsoft%20Entra%20architecture%20icons%20-%20Oct%202023.zip',
    license: 'Microsoft terms of use shipped with the archive.',
    terms: [/Microsoft Terms of Use\.docx$/],
  },
  fabric: {
    title: 'Microsoft Fabric item and product icons',
    page: 'https://learn.microsoft.com/en-us/fabric/fundamentals/icons',
    linkPattern: /https:\/\/github\.com\/microsoft\/fabric-samples\/blob\/main\/docs-samples\/Icons\.zip/,
    fallback: 'https://raw.githubusercontent.com/microsoft/fabric-samples/main/docs-samples/Icons.zip',
    toRaw: (url) => url.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace('/blob/', '/'),
    license: 'MIT (@fabric-msft/svg-icons, Copyright Microsoft Corporation).',
    terms: [/package\/LICENSE$/],
  },
  d365: {
    title: 'Dynamics 365 icons',
    page: 'https://learn.microsoft.com/en-us/dynamics365/get-started/icons',
    linkPattern: /https:\/\/download\.microsoft\.com\/download\/[^"'\s]+Dynamics-365-icons-scalable\.zip/,
    fallback: 'https://download.microsoft.com/download/498606aa-6d27-4f13-aa5c-1401078c153b/Dynamics-365-icons-scalable.zip',
    license: 'Microsoft public-use icon licence shipped with the archive (CELA_Licenses_Public_Use_Icons.pdf).',
    terms: [/CELA_Licenses_Public_Use_Icons\.pdf$/],
  },
};

const LUCIDE_VERSION = '1.75.0';

PACKS.generic = {
  title: 'Generic system icons (Lucide)',
  page: 'https://lucide.dev/',
  tarball: true,
  fallback: `https://registry.npmjs.org/lucide-static/-/lucide-static-${LUCIDE_VERSION}.tgz`,
  license: 'ISC (Lucide Icons and Contributors); a few glyphs derive from Feather (MIT). Line art, drawn in the node colour.',
  terms: [/package\/LICENSE$/],
};

const M365_FAMILIES = [
  ['SharePoint Teal/48x48 SVG Icon', 'sharepoint'],
  ['Teams Purple/48x48 Dark Purple Icon', 'teams'],
  ['Microsoft Blue/48x48 Dark Blue Icon', 'blue'],
  ['Microsoft Purple/48x48 SVG Icons', 'purple'],
  ['Project Green/48x48 SVG Icons', 'project'],
  ['Planner Green/48x48 SVG Icons', 'planner'],
];

function slug(value) {
  return String(value).toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function walk(directory) {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

function toPosix(file) {
  return file.split(path.sep).join('/');
}

// ---------------------------------------------------------------- selection

function azureCandidates(root, files) {
  const candidates = [];
  for (const file of files) {
    const rel = toPosix(path.relative(root, file));
    const match = rel.match(/(?:^|\/)Icons\/([^/]+)\/\d+-icon-service-(.+)\.svg$/i);
    if (!match) continue;
    const name = match[2];
    const title = name.replace(/-/g, ' ');
    const base = slug(name);
    candidates.push({
      id: base.startsWith('azure-') ? base : `azure-${base}`,
      title,
      category: slug(match[1]),
      file,
      origin: rel,
    });
  }
  return candidates;
}

function m365Candidates(root, files) {
  const candidates = [];
  for (const file of files) {
    const rel = toPosix(path.relative(root, file));
    for (const [dir, family] of M365_FAMILIES) {
      if (!rel.includes(`${dir}/`) || !rel.toLowerCase().endsWith('.svg')) continue;
      const stem = path.basename(rel, '.svg').replace(/_(Teams|Blue|Purple|Green|Teal)(_(Dark|Light|Gray))?$/i, '');
      const title = stem.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      candidates.push({ id: `m365-${family}-${slug(title)}`, title, category: family, file, origin: rel });
    }
  }
  return candidates;
}

function entraCandidates(root, files) {
  const candidates = [];
  for (const file of files) {
    const rel = toPosix(path.relative(root, file));
    if (!/color icons SVG\//i.test(rel) || !rel.endsWith('.svg')) continue;
    const stem = path.basename(rel, '.svg');
    const title = stem.replace(/\s+color icon$/i, '').replace(/^Microsoft\s+/i, '').trim();
    candidates.push({ id: `entra-${slug(title.replace(/^Entra\s+/i, ''))}`, title: `Microsoft ${title}`, category: 'entra', file, origin: rel });
  }
  return candidates;
}

function fabricCandidates(root, files) {
  const pick = [
    [/\/([a-z0-9_]+)_48_item\.svg$/, 'items', 0],
    [/\/([a-z0-9_]+)_32_color\.svg$/, 'products', 1],
    [/\/([a-z0-9_]+)_48_non-item\.svg$/, 'actions', 2],
  ];
  const byBase = new Map();
  for (const file of files) {
    const rel = toPosix(path.relative(root, file));
    if (!/\/dist\/svg\//.test(rel)) continue;
    for (const [pattern, category, rank] of pick) {
      const match = rel.match(pattern);
      if (!match) continue;
      const existing = byBase.get(match[1]);
      if (!existing || rank < existing.rank) byBase.set(match[1], { rank, category, file, rel, base: match[1] });
    }
  }
  return [...byBase.values()].map(({ base, category, file, rel }) => {
    const title = base.split('_').map((word) => (word === 'bi' ? 'BI' : word[0].toUpperCase() + word.slice(1))).join(' ');
    return { id: base === 'fabric' ? 'fabric' : `fabric-${slug(base)}`, title: `Fabric ${title}`.replace(/^Fabric Fabric$/, 'Microsoft Fabric'), category, file, origin: rel };
  });
}

function d365Candidates(root, files) {
  const candidates = [];
  for (const file of files) {
    const rel = toPosix(path.relative(root, file));
    if (!rel.endsWith('_scalable.svg')) continue;
    const stem = path.basename(rel, '_scalable.svg');
    const title = stem.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2');
    const category = /Product Family/i.test(rel) ? 'product-family' : 'apps';
    candidates.push({ id: `d365-${slug(title)}`, title: stem === 'Dynamics365' ? 'Dynamics 365' : `Dynamics 365 ${title}`, category, file, origin: rel });
  }
  return candidates;
}


// [id, Lucide file, title, category, aliases]. These stand for components that
// are not Microsoft services (the Azure packs cover those). Aliases are what an
// author or agent is likely to type; the renderer also infers an icon from a
// node's label and type (renderers/shared/generic-icons.mjs).
const GENERIC_ICONS = [
  ['generic-user', 'user', 'User', 'people', ['user', 'end user', 'person', 'customer', 'actor']],
  ['generic-users', 'users', 'Users', 'people', ['users', 'end users', 'customers', 'people', 'team']],
  ['generic-admin', 'user-cog', 'Administrator', 'people', ['admin', 'administrator', 'operator', 'back office user']],
  ['generic-browser', 'app-window', 'Browser', 'clients', ['browser', 'web browser', 'web client', 'single page app', 'spa', 'web ui', 'frontend']],
  ['generic-mobile-app', 'smartphone', 'Mobile app', 'clients', ['mobile', 'mobile app', 'phone', 'ios app', 'android app']],
  ['generic-desktop-app', 'monitor', 'Desktop app', 'clients', ['desktop', 'desktop app', 'workstation', 'thick client']],
  ['generic-dashboard', 'layout-dashboard', 'Dashboard', 'clients', ['dashboard', 'admin dashboard', 'admin portal', 'back office']],
  ['generic-api-server', 'server', 'API server', 'compute', ['api server', 'api', 'rest api', 'backend api', 'app server', 'application server', 'server', 'web server']],
  ['generic-microservice', 'box', 'Microservice', 'compute', ['microservice', 'service', 'internal service', 'backend service']],
  ['generic-worker', 'cog', 'Worker', 'compute', ['worker', 'background worker', 'job worker', 'consumer', 'processor']],
  ['generic-scheduler', 'calendar-clock', 'Scheduler', 'compute', ['scheduler', 'cron', 'timer', 'scheduled job', 'cron job']],
  ['generic-batch-job', 'layers', 'Batch job', 'compute', ['batch', 'batch job', 'batch processing']],
  ['generic-container', 'container', 'Container', 'compute', ['container', 'docker container']],
  ['generic-serverless-function', 'zap', 'Serverless function', 'compute', ['serverless function', 'serverless']],
  ['generic-gateway', 'waypoints', 'API gateway', 'networking', ['api gateway', 'gateway', 'reverse proxy', 'proxy', 'ingress']],
  ['generic-load-balancer', 'split', 'Load balancer', 'networking', ['load balancer', 'balancer']],
  ['generic-network', 'network', 'Network', 'networking', ['network', 'private network', 'lan']],
  ['generic-internet', 'globe', 'Internet', 'networking', ['internet', 'public internet', 'web']],
  ['generic-database', 'database', 'Database', 'data', ['database', 'db', 'relational database', 'data store', 'datastore']],
  ['generic-cache', 'database-zap', 'Cache', 'data', ['cache', 'in-memory cache']],
  ['generic-object-storage', 'archive', 'Object storage', 'data', ['object storage', 'bucket']],
  ['generic-file-storage', 'folder', 'File storage', 'data', ['file storage', 'file share', 'filesystem']],
  ['generic-data-warehouse', 'table-2', 'Data warehouse', 'data', ['data warehouse', 'warehouse', 'olap']],
  ['generic-data-lake', 'waves', 'Data lake', 'data', ['data lake']],
  ['generic-search-index', 'search', 'Search index', 'data', ['search', 'search index', 'search engine', 'full-text search']],
  ['generic-queue', 'list-end', 'Queue', 'messaging', ['queue', 'message queue', 'job queue', 'task queue', 'work queue']],
  ['generic-event-bus', 'radio', 'Event bus', 'messaging', ['event bus', 'event broker', 'pub/sub', 'pubsub', 'topic', 'message broker', 'broker']],
  ['generic-event-stream', 'activity', 'Event stream', 'messaging', ['event stream', 'stream', 'streaming', 'event log']],
  ['generic-webhook', 'webhook', 'Webhook', 'messaging', ['webhook', 'callback']],
  ['generic-email', 'mail', 'Email', 'messaging', ['email', 'smtp', 'mail service', 'email service']],
  ['generic-notification', 'bell', 'Notifications', 'messaging', ['notification', 'notifications', 'push notification', 'alerts']],
  ['generic-chat', 'message-square', 'Messaging', 'messaging', ['sms', 'chat', 'messaging']],
  ['generic-identity-provider', 'key-round', 'Identity provider', 'security', ['identity provider', 'idp', 'sso', 'single sign-on', 'auth', 'authentication', 'oauth', 'login']],
  ['generic-secrets', 'lock-keyhole', 'Secrets', 'security', ['secrets', 'secret store', 'vault', 'key store', 'secrets manager', 'kms']],
  ['generic-firewall', 'brick-wall', 'Firewall', 'security', ['firewall', 'waf']],
  ['generic-security', 'shield-check', 'Security', 'security', ['security', 'access control', 'authorization', 'rbac', 'policy']],
  ['generic-monitoring', 'gauge', 'Monitoring', 'operations', ['monitoring', 'metrics', 'observability', 'apm']],
  ['generic-logging', 'scroll-text', 'Logging', 'operations', ['logging', 'logs', 'log aggregation', 'audit log']],
  ['generic-ci-cd', 'git-branch', 'CI/CD', 'operations', ['ci/cd', 'cicd', 'build pipeline', 'deploy pipeline']],
  ['generic-configuration', 'sliders-horizontal', 'Configuration', 'operations', ['configuration', 'config', 'feature flags', 'settings']],
  ['generic-payments', 'credit-card', 'Payments', 'business', ['payments', 'payment gateway', 'billing', 'checkout']],
  ['generic-analytics', 'chart-column', 'Analytics', 'business', ['analytics', 'reporting', 'business intelligence']],
  ['generic-agent', 'bot', 'AI agent', 'business', ['ai agent', 'agent', 'agents', 'agent framework', 'microsoft agent framework', 'copilot agent']],
  ['generic-vector-database', 'database-search', 'Vector database', 'data', ['vector database', 'vector db', 'vector store', 'embeddings store']],
  ['generic-ml-model', 'brain-circuit', 'ML model', 'business', ['ml model', 'machine learning', 'ai model', 'inference', 'llm']],
  ['generic-etl', 'shuffle', 'ETL', 'business', ['etl', 'data pipeline', 'data integration', 'ingestion']],
  ['generic-iot-device', 'cpu', 'IoT device', 'business', ['iot device', 'device', 'sensor', 'edge device', 'iot']],
  ['generic-external-api', 'plug', 'External API', 'business', ['external api', 'third-party api', 'third party', 'partner api', 'integration', 'external system']],
  ['generic-cloud-service', 'cloud', 'Cloud service', 'business', ['cloud service', 'saas']],
];

function genericCandidates(root, files) {
  return GENERIC_ICONS.map(([id, lucide, title, category, pinned]) => {
    const file = files.find((candidate) => toPosix(candidate).endsWith(`/package/icons/${lucide}.svg`));
    if (!file) throw new Error(`lucide-static ${LUCIDE_VERSION} has no icons/${lucide}.svg`);
    return { id, title, category, pinned, file, origin: `lucide-static/icons/${lucide}.svg` };
  });
}

const SELECTORS = {
  azure: azureCandidates, m365: m365Candidates, entra: entraCandidates, fabric: fabricCandidates, d365: d365Candidates,
  generic: genericCandidates,
};

// ---------------------------------------------------------------- sync

function autoAliases(icon) {
  const lower = icon.title.toLocaleLowerCase('en-US');
  const aliases = new Set([lower]);
  aliases.add(lower.replace(/^(azure|microsoft|dynamics 365|fabric)\s+/, ''));
  for (const value of [...aliases]) {
    if (/[^s]s$/.test(value)) aliases.add(value.slice(0, -1));
  }
  aliases.delete(icon.id);
  aliases.delete('');
  return [...aliases];
}

function loadManualAliases() {
  try {
    return JSON.parse(fs.readFileSync(ALIASES_FILE, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

function buildPack(name, root) {
  const files = walk(root);
  const candidates = SELECTORS[name](root, files).sort((a, b) => a.origin.localeCompare(b.origin));
  const seen = new Map();
  const kept = [];
  const dropped = [];
  for (const candidate of candidates) {
    const bytes = fs.readFileSync(candidate.file);
    const inspected = inspectIconSvg(bytes.toString('utf8'));
    if (!inspected.ok) {
      dropped.push(`${candidate.origin}: ${inspected.reason}`);
      continue;
    }
    const previous = seen.get(candidate.id);
    if (previous) {
      if (previous.sha256 !== sha256(bytes)) dropped.push(`${candidate.origin}: duplicate id ${candidate.id} with different artwork (kept ${previous.origin})`);
      continue;
    }
    const entry = {
      ...candidate,
      sha256: sha256(bytes),
      viewBox: inspected.viewBox.join(' '),
      bytes,
    };
    seen.set(candidate.id, entry);
    kept.push(entry);
  }
  return { kept, dropped, candidates: candidates.length };
}

function fileFor(pack, id) {
  const stem = id.startsWith(`${pack}-`) ? id.slice(pack.length + 1) : id;
  return `${pack}/${stem}.svg`;
}

async function fetchBuffer(url) {
  const host = new URL(url).hostname;
  if (!ARCHIVE_ALLOWED_HOSTS.has(host)) throw new Error(`Refusing to download from unexpected host ${host}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function resolveDownloadUrl(pack) {
  const definition = PACKS[pack];
  if (!definition.linkPattern) return definition.fallback;
  try {
    const page = (await fetchBuffer(definition.page)).toString('utf8');
    const match = page.match(definition.linkPattern);
    if (match) return definition.toRaw ? definition.toRaw(match[0]) : match[0];
  } catch (error) {
    console.warn(`warning: could not read ${definition.page} (${error.message}); using the last known link`);
  }
  return definition.fallback;
}

function extract(zipFile, destination) {
  fs.mkdirSync(destination, { recursive: true });
  // unzip refuses `..` path escapes by default; -q keeps the output quiet.
  execFileSync('unzip', ['-q', '-o', zipFile, '-d', destination], { stdio: 'inherit' });
}

function extractTarball(file, destination) {
  fs.mkdirSync(destination, { recursive: true });
  execFileSync('tar', ['-xzf', file, '-C', destination, 'package/icons', 'package/LICENSE'], { stdio: 'inherit' });
}

function readExistingCatalog() {
  try {
    return JSON.parse(fs.readFileSync(ICON_CATALOG_FILE, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return { packs: {}, icons: [] };
    throw error;
  }
}

function writeOutputs(results, archives) {
  const manual = loadManualAliases();
  const existing = readExistingCatalog();
  const ids = new Set();
  const catalogIcons = [];
  // Packs that were not refreshed (--only) keep their catalogue entries as they are.
  for (const pack of Object.keys(PACKS)) {
    const result = results[pack];
    if (!result) {
      for (const icon of existing.icons.filter((entry) => entry.pack === pack)) {
        ids.add(icon.id);
        catalogIcons.push(icon);
      }
      continue;
    }
    fs.rmSync(path.join(ICON_PACKS_ROOT, pack), { recursive: true, force: true });
    for (const icon of result.kept) {
      if (ids.has(icon.id)) throw new Error(`Duplicate icon id across packs: ${icon.id}`);
      ids.add(icon.id);
      const relative = fileFor(pack, icon.id);
      const target = path.join(ICON_PACKS_ROOT, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, icon.bytes);
      const entry = {
        id: icon.id,
        title: icon.title,
        pack,
        category: icon.category,
        pinned: manual[icon.id] || icon.pinned || [],
        aliases: [],
        file: relative,
        sha256: icon.sha256,
        viewBox: icon.viewBox,
        origin: icon.origin,
      };
      entry.aliases = [...new Set([...entry.pinned, ...autoAliases(entry)])];
      catalogIcons.push(entry);
    }
    // Ship the terms that came with the archive, unmodified.
    const termsDir = path.join(ICON_PACKS_ROOT, pack);
    for (const file of result.termsFiles || []) {
      fs.copyFileSync(file, path.join(termsDir, `TERMS-${path.basename(file).replace(/\s+/g, '_')}`));
    }
  }
  for (const key of Object.keys(manual)) {
    if (!ids.has(key)) throw new Error(`aliases.json names unknown icon id "${key}"`);
  }
  const header = {
    schemaVersion: 1,
    packs: Object.fromEntries(Object.entries(PACKS).map(([name, definition]) => [name, results[name] ? {
      title: definition.title,
      page: definition.page,
      license: definition.license,
      archive: archives[name],
    } : existing.packs[name]])),
  };
  const lines = catalogIcons.map((icon) => `    ${JSON.stringify(icon)}`).join(',\n');
  const headerJson = JSON.stringify(header, null, 2).replace(/\n}$/, '');
  fs.writeFileSync(ICON_CATALOG_FILE, `${headerJson},\n  "icons": [\n${lines}\n  ]\n}\n`);
  fs.writeFileSync(SOURCES_FILE, renderSources(results, archives, catalogIcons));
  return catalogIcons;
}

function renderSources(results, archives, icons) {
  // Rows and exclusion lines of packs that were not refreshed are carried over verbatim.
  let previous = '';
  try { previous = fs.readFileSync(SOURCES_FILE, 'utf8'); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const previousLines = previous.split('\n');
  const rows = Object.entries(PACKS).map(([name, definition]) => {
    const result = results[name];
    if (!result) return previousLines.find((line) => line.startsWith(`| \`${name}\` |`));
    const archive = archives[name];
    return `| \`${name}\` | [${definition.title}](${definition.page}) | \`${archive.url}\` | \`${archive.sha256.slice(0, 16)}…\` | ${result.kept.length} of ${result.candidates} | ${definition.license} |`;
  }).filter(Boolean);
  const dropped = Object.keys(PACKS).flatMap((name) => (results[name]
    ? results[name].dropped.map((line) => `- \`${name}\` ${line}`)
    : previousLines.filter((line) => line.startsWith(`- \`${name}\` `))));
  return `# Icon pack sources

Generated by \`scripts/sync-icon-packs.mjs\`. Do not edit by hand.

| Pack | Official page | Archive | SHA-256 | Icons kept | Licence |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

${icons.length} icons in total. Curated SVG files are byte-for-byte copies of the
originals; \`catalog.json\` records each file's digest and original path.

## Using the icons correctly

- The \`azure\`, \`m365\`, \`entra\`, \`fabric\` and \`d365\` packs may illustrate
  Azure and Microsoft products in architecture diagrams, training material or
  documentation. Keep the product name next to the icon (use the service name
  as the node label).
- Do not crop, flip, rotate, distort or recolour a Microsoft icon, and do not use
  one to represent your own product or service.
- The \`generic\` pack is Lucide line art (ISC licence) for components that are
  not Microsoft services: users, API servers, queues, caches and so on. It is
  drawn in each node's own colour, so it is the one pack the renderer recolours.
- The terms files shipped with each archive are copied next to the icons as
  \`TERMS-*\`.

## Files excluded by the safety check

${dropped.length ? dropped.join('\n') : 'None.'}
`;
}

function check() {
  const catalog = JSON.parse(fs.readFileSync(ICON_CATALOG_FILE, 'utf8'));
  const problems = [];
  const ids = new Set();
  const files = new Set();
  for (const icon of catalog.icons) {
    if (ids.has(icon.id)) problems.push(`duplicate id ${icon.id}`);
    ids.add(icon.id);
    if (files.has(icon.file)) problems.push(`duplicate file ${icon.file}`);
    files.add(icon.file);
    if (icon.id.length > 80) problems.push(`${icon.id}: id longer than 80 characters`);
    const full = path.join(ICON_PACKS_ROOT, icon.file);
    if (!fs.existsSync(full)) { problems.push(`${icon.id}: missing ${icon.file}`); continue; }
    const bytes = fs.readFileSync(full);
    if (sha256(bytes) !== icon.sha256) problems.push(`${icon.id}: digest mismatch`);
    const inspected = inspectIconSvg(bytes.toString('utf8'));
    if (!inspected.ok) problems.push(`${icon.id}: ${inspected.reason}`);
  }
  for (const pack of Object.keys(PACKS)) {
    const dir = path.join(ICON_PACKS_ROOT, pack);
    if (!fs.existsSync(dir)) { problems.push(`pack directory ${pack} is missing`); continue; }
    for (const file of walk(dir)) {
      const rel = toPosix(path.relative(ICON_PACKS_ROOT, file));
      if (rel.endsWith('.svg') && !files.has(rel)) problems.push(`${rel} is not in catalog.json`);
    }
  }
  const manual = loadManualAliases();
  for (const key of Object.keys(manual)) if (!ids.has(key)) problems.push(`aliases.json: unknown id ${key}`);
  if (problems.length) {
    console.error(`Icon pack check failed:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Icon packs OK: ${catalog.icons.length} icons across ${Object.keys(catalog.packs).length} packs.`);
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name) => { const index = args.indexOf(name); return index === -1 ? null : args[index + 1]; };
  if (args.includes('--check')) return check();
  const archivesDir = value('--from-archives');
  const download = args.includes('--download');
  if (!download && !archivesDir) {
    console.error('Usage: sync-icon-packs.mjs --download [--only PACK[,PACK]] [--cache-dir DIR] | --from-archives DIR | --check');
    process.exit(2);
  }
  const cache = path.resolve(value('--cache-dir') || archivesDir || fs.mkdtempSync(path.join(os.tmpdir(), 'ms-icons-')));
  fs.mkdirSync(cache, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-icons-extract-'));
  const results = {};
  const archives = {};
  try {
    const only = value('--only');
    const names = only ? only.split(',').map((name) => name.trim()) : Object.keys(PACKS);
    for (const name of names) if (!PACKS[name]) throw new Error(`Unknown pack "${name}"; choose from ${Object.keys(PACKS).join(', ')}`);
    for (const name of names) {
      const archiveName = `${name}.${PACKS[name].tarball ? 'tgz' : 'zip'}`;
      const zip = path.join(cache, archiveName);
      let url = `file:${archiveName}`;
      if (download) {
        url = await resolveDownloadUrl(name);
        console.log(`${name}: ${url}`);
        fs.writeFileSync(zip, await fetchBuffer(url));
      } else if (!fs.existsSync(zip)) {
        throw new Error(`${zip} not found`);
      }
      archives[name] = { url, sha256: sha256(fs.readFileSync(zip)) };
      const target = path.join(work, name);
      if (PACKS[name].tarball) extractTarball(zip, target);
      else extract(zip, target);
      results[name] = buildPack(name, target);
      results[name].termsFiles = walk(target).filter((file) => PACKS[name].terms.some((pattern) => pattern.test(toPosix(file))));
      console.log(`${name}: kept ${results[name].kept.length}/${results[name].candidates}, dropped ${results[name].dropped.length}`);
    }
    const icons = writeOutputs(results, archives);
    console.log(`Wrote ${icons.length} icons to ${path.relative(process.cwd(), ICON_PACKS_ROOT) || '.'}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && sameEntry(process.argv[1], fileURLToPath(import.meta.url)).status === 'match') {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}
