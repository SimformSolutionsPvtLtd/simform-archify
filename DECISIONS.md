# Decisions for Simform Archify

This is Simform's fork of [tt-a1i/archify](https://github.com/tt-a1i/archify) (v3.2.0, Apache-2.0).
Every choice made while adapting it is recorded here with the reason and the way
to reverse it, so any of them can be revisited. Entries are numbered; the code
and docs refer to them as `D-nn`.

| ID | Decision | Status |
| --- | --- | --- |
| D-01 | Fork archify instead of building a new skill | Done |
| D-02 | Skill name is `simform-archify`; internal names stay `archify` | Done |
| D-03 | Simform brand applied by re-skinning the default preset | Done |
| D-04 | Node-type colours use the Simform palette, never red | Done, review welcome |
| D-05 | Default theme is light, not the OS setting | Done |
| D-06 | Inter replaces JetBrains Mono (latin + latin-ext only) | Done |
| D-07 | All five Microsoft icon packs, curated | Done |
| D-08 | Icons stay unmodified and reuse the `brand` field | Done |
| D-09 | Architecture icons are 48px in a left gutter; other diagram types keep a 24px corner tile | Done (revised from a 24px corner tile) |
| D-10 | Icon SVGs are sanitised and inlined as a transformed `<g>` | Done |
| D-11 | Friendly names live in `icon-packs/aliases.json` | Done |
| D-12 | Upstream update check is off by default | Done |
| D-13 | SharePoint embedding uses the existing `?present=1` mode | Done, not tried in a real tenant |
| D-14 | Checked-in artifacts regenerated; `docs/` and translations left alone | Done |
| D-15 | Things downloaded to build this | Done |
| D-16 | Known gaps and open items | Open |
| D-17 | Azure connection labels follow Azure Architecture Center wording | Done |
| D-18 | This repository is its own Claude plugin marketplace | Done |
| D-19 | Generic components get Lucide line icons, inferred when `brand` is missing | Done |
| D-20 | The skill asks which Azure architecture style to draw, defaulting to Microservices | Done |
| D-21 | Viewer polish: sentence-case labels, no looping chrome, quiet legend counts | Done, review welcome |
| D-22 | More built-in brand marks (AI and data stack); built-in marks use the 48px gutter in architecture diagrams | Done |
| D-23 | Upstream's website, proof gallery and Pages/Cloudflare deploys are removed | Done |
| D-24 | Upstream-only docs, evidence, benchmarks, community and integrations are removed | Done |
| D-25 | AI-stack logos live in a seventh icon pack, and architecture diagrams must be grouped by layer | Done, review welcome |

---

## D-01 Fork archify instead of building a new skill

**Decided:** keep archify's engine (ten diagram types, validation, layout checks,
interactive viewer, exports) and change its look and icons.
**Why:** colours are CSS variables in one generated template, and node marks already
flow through one `brand` path. Rebuilding the validation, routing and viewer would
cost far more than reskinning them.
**Reverse:** none needed; a new skill would start from this repository anyway.

## D-02 Skill name is `simform-archify`; internal names stay `archify`

**Decided:** `archify/SKILL.md` has `name: simform-archify`. The folder `archify/`,
the CLI `archify/bin/archify.mjs`, the package name, `archify.zip`, `skillId` in
`archify/skill-release.json` and the `archify`-prefixed environment variables are
unchanged. `AGENTS.md`, `llms.txt` and the install/metadata tests use the new name.
**Why:** the skill name is what Claude Code and the Skills CLI show and install by.
Renaming folders, binaries and the update contract would touch hundreds of files and
make every upstream merge conflict.
**Reverse:** change `name:` in `archify/SKILL.md` and the three test files that assert
it (`test/skill-metadata.test.mjs`, `test/skill-installation.test.mjs`,
`test/llms-txt.test.mjs`), plus `AGENTS.md` and `llms.txt`.

## D-03 Simform brand applied by re-skinning the default preset

**Decided:** the default `classic` preset now carries the Simform tokens (`viewer/viewer.css`,
top of file). The upstream presets `signal-flow`, `blueprint` and `editorial` still exist
and keep their own looks. The toolbar still says "Classic".
**Why:** adding a fifth preset means editing the preset menu, six locale catalogues and
their tests. Re-skinning the default brands every diagram with no schema change.
**Reverse:** restore the two token blocks in `viewer/viewer.css` from upstream, then
`node scripts/generate-viewer.mjs` and re-render the examples (see D-14).
**Follow-up if wanted:** rename the "Classic" label to "Simform" in `archify/locales/*.json`.

## D-04 Node-type colours use the Simform palette, never red

**Decided** (light / dark):

| Node type | Light stroke | Dark stroke | Note |
| --- | --- | --- | --- |
| `frontend` | `#5b2a9e` | tint of `#5b2a9e` | brand purple |
| `backend` | `#34a0a4` darkened 28% toward text | `#34a0a4` | teal |
| `database` | `#380d6f` | tint of `#380d6f` | deep purple |
| `cloud` | `#d84315` | tint of `#d84315` | orange accent |
| `security` | `#1a1024` | `#f3eef9` | plum text colour |
| `messagebus` | blend of `#5b2a9e` and `#34a0a4` | lighter blend | only derived colour |
| `external` | `#6b6478` | `#b3a8c7` | muted |

Brand red `#e0314c` (coral `#ef5366` on dark) is used only for the emphasised flow.
Canvas `#f4f1fb`, white panels, text `#1a1024`, muted `#6b6478`, borders `#e5def1`; dark
uses `#18052f` / `#241043` / `#3a2a5a` / `#f3eef9`.
**Why:** the Simform system allows one red focal point and forbids a second brand colour,
so red cannot mark a node category. Seven categories need seven distinguishable hues from
a small palette: five come straight from it, `messagebus` is a blend of two palette colours,
and dark-mode strokes are palette colours tinted toward `#f3eef9` for contrast.
`color-mix` keeps the derived colours traceable to palette tokens.
**Weak spots:** `security` and `external` read similar in dark mode; teal text on white is
5.1:1 after darkening (the raw token is 3.1:1); orange `#d84315` is 4.4:1 on white, just under
the 4.5:1 line for small text. Edit the 14 `--*-stroke/-fill` variables
in `viewer/viewer.css` to change any of it.

## D-05 Default theme is light, not the OS setting

**Decided:** with no saved choice and no `?theme=`, the viewer opens light. It no longer
follows live changes to the OS colour scheme. The toggle and `?theme=dark` still work and
the toggle choice is remembered.
**Why:** light is the Simform canvas and matches SharePoint pages; following the OS would
make the same diagram look different on each reader's machine.
**Reverse:** restore the `prefers-color-scheme` branches in `viewer/template.source.html`
(head script and `resolveInitial`) and the live-change listener, then regenerate the viewer.

## D-06 Inter replaces JetBrains Mono (latin + latin-ext only)

**Decided:** diagram text and viewer chrome use Inter, embedded as base64 WOFF2 (latin and
latin-ext subsets of `@fontsource-variable/inter` 5.3.0, weights 100-900, about 180 KB per
HTML file). JetBrains Mono is no longer embedded. Cyrillic, Greek, Vietnamese and CJK text
fall back to the system font. Class-diagram member names use the system monospace stack.
**Why:** Inter is the only Simform typeface. Embedding keeps files self-contained, which
SharePoint hosting needs. Two subsets keep each file under 1 MB.
**Reverse / extend:** add more `@font-face` subsets in `viewer/template.source.html` from the
same package and update `test/helpers/offline-fonts.mjs` (pinned hashes and ranges).
`archify/assets/Inter-OFL.txt` carries the licence the test requires.

## D-07 All five Microsoft icon packs, curated

**Decided:** `archify/icon-packs/` holds 1,097 icons:

| Pack | Kept | Rule |
| --- | --- | --- |
| Azure (V25) | 639 | every service icon; same-name duplicates across categories collapsed |
| Microsoft 365 | 360 | one variant for each of 6 families: SharePoint, Teams, Microsoft Blue, Microsoft Purple, Project, Planner |
| Microsoft Entra | 7 | colour icons only (the black-and-white set is skipped) |
| Microsoft Fabric | 75 | item icons at 48px, product icons at 32px, action icons at 48px |
| Dynamics 365 | 16 | all scalable app and family icons |

Six Azure files were dropped: five were duplicate ids with different artwork, one used a
`<style>` block. They are listed in `icon-packs/SOURCES.md`.
**Why:** the user named all five sources. Full archives are 50 MB (Fabric alone is 1,584 SVGs
at six sizes plus Fluent glyphs); the curated set is 5.3 MB and covers architecture use.
**Reverse / widen:** edit the selector functions in `archify/scripts/sync-icon-packs.mjs`
and run `npm --prefix archify run sync:icon-packs`.

## D-08 Icons stay unmodified and reuse the `brand` field

**Decided:** SVG files are byte-for-byte copies; `catalog.json` records each file's SHA-256
and original path, and the renderer refuses a file whose hash differs. No recolouring,
cropping or reshaping. A node selects an icon with `"brand": "app service"` (or the exact id).
The JSON schemas are unchanged.
**Why:** Microsoft's terms allow the icons in architecture diagrams but forbid changing them
and ask for the product name beside the icon. Reusing `brand` means every diagram type that
supports brand marks (architecture, workflow, sequence, dataflow, lifecycle) gets icons.
`.gitattributes` marks `archify/icon-packs/**` as `-text` because two Microsoft files use CRLF line
endings; without it git would rewrite them and the recorded hashes would stop matching.
**Reverse:** delete `archify/icon-packs/`, `renderers/shared/icon-packs.mjs` and the pack
branches in `renderers/shared/brand-marks.mjs`.

## D-09 Architecture icons are 48px in a left gutter; other types keep a 24px corner tile

**Decided:** on architecture diagrams a pack icon draws at 48px on a white rounded tile, vertically
centred in a left gutter, with the label and sublabel left-aligned beside it; the node-type glyph
moves to the top-right corner. Azure nodes in the example are 210x76 on columns 90px apart.
Workflow, sequence, data-flow and lifecycle diagrams still draw a 24px tile in the top-right
corner (built-in brand marks stay 16px everywhere).
**Why:** the first version (24px corner tile, 20px of artwork) read as about 8px once the diagram
was fit to the screen. Five layouts were compared (corner 24 and 32, left 40 and 48, top 44);
left 48 gave the most legible icons without the tall nodes that make the top layout shrink the
whole diagram.
**How to reverse or tune:** the placement is chosen in `placementFor` in
`archify/renderers/shared/brand-marks.mjs`. Set `SIMFORM_ICON_VARIANT=corner:24` (or
`left:40`, `left:48`, `top:44`, `corner:32`) to override it for architecture diagrams without
editing code. Sizes are 16 to 64px.
**Not done:** the other four renderers use their own label layouts; moving them to the gutter
layout needs per-renderer work (`brandPlacement` is written to be reused).

## D-10 Icon SVGs are sanitised and inlined as a transformed `<g>`

**Decided:** only a fixed list of SVG elements is accepted (no script, style, image,
foreignObject, external references or event handlers); ids and `url(#id)` references are
prefixed per node so repeated icons do not collide. The art is placed with a `<g transform>`
because delivery requires exactly one `<svg>` per file.
**Why:** the files come from downloads and end up inside HTML that SharePoint will frame.
**Reverse:** relax `ALLOWED_ELEMENTS` in `archify/renderers/shared/icon-packs.mjs`.

## D-11 Friendly names live in `icon-packs/aliases.json`

**Decided:** 257 hand-written aliases for 105 icons ("aks", "azure sql", "front door", "entra", ...)
take priority over names derived from file titles. `sync-icon-packs.mjs` fails if an alias
names an unknown id.
**Why:** official file names are plural and inconsistent ("Key-Vaults", "Front-Door-and-CDN-Profiles").
**Extend:** add entries, run `npm --prefix archify run sync:icon-packs` (or edit
`catalog.json` through the script), then `npm --prefix archify run check:icon-packs`.

## D-12 Upstream update check is off by default

**Decided:** `archify/bin/archify.mjs` sets `ARCHIFY_UPDATE_CHECK_DISABLED=1` unless
`SIMFORM_ARCHIFY_UPDATE_CHECK=1`. `skillId`, `source.repository` and the manifest URL still
name upstream.
**Why:** the check only knows tt-a1i/archify, so it would tell Simform users to replace this
fork with upstream. Changing the identity would break the update contract and its tests.
**Reverse:** remove the guard at the top of `archify/bin/archify.mjs`. To check Simform
releases, publish a manifest and change `EXPECTED_REPOSITORY`, `DEFAULT_MANIFEST_URL` and
`SKILL_ID` in `archify/scripts/update-contract.mjs`.

## D-13 SharePoint embedding uses the existing `?present=1` mode

**Decided:** no new viewer mode. The viewer already has `?present=1` (interactive stage that
fills the frame) and `?embed=1` (static diagram only). The deliverable is documentation:
`archify/references/sharepoint-embed.md`. The file makes no network requests, has no
frame-busting, and guards `localStorage`.
**Verified:** the example, in headless Chrome inside `<iframe sandbox="allow-scripts">` with
`?present=1`, renders and the toolbar shows. **Not verified:** a real SharePoint tenant. The
host headers (`frame-ancestors`), HTML Field Security allow-list and Embed web part behaviour
depend on your tenant and host.
**Open choice:** SharePoint can host the HTML itself only if your tenant renders `.html`
inline, which is not typical. The guide recommends an HTTPS static host (Azure Storage static
website or Static Web Apps).

## D-14 Checked-in artifacts regenerated; `docs/` and translations left alone

**Decided:**
- Regenerated: `archify/examples/*.html`, `examples/*.html`, the delta page and receipt,
  `archify/assets/template.html`, the `docs/gallery` proof pages (`npm --prefix archify run build:gallery`),
  `archify.zip`.
- `archify.zip` was built by running the stage and zip scripts directly with Node 22.13.1, because
  `scripts/build-zip.sh` insists on a Node 22 whose bundled zlib is `1.3.1-e00f703`. Its contents are
  correct but its bytes may differ from a canonical build. Rebuild with `scripts/build-zip.sh` on a
  matching official Node 22 before a release.
- `README.md` and `README_EN.md` rewritten (kept byte-identical, as upstream checks require).
- Left as upstream: `README_ZH/JA/KO.md`, `docs/` (the archify.si site build and community
  cases that need external repositories), `website/`, `community/`, `integrations/`, `journal/`.
- `test/offline-self-containment.test.mjs` no longer scans `docs/`.
- Eight upstream README-structure tests (`readme-showcase`, `cursor-onboarding`, `preview-contract`,
  `reach-share-card`, `route-share-card`, `real-repository-proof`, `community-proof-intake`,
  `automatic-port-spread`) now assert on the upstream translations only, because the English README is
  the fork's own. They still pass on `README_ZH.md` and `README_JA.md`.
- `DESIGN.md` documents the Simform tokens and Inter; `viewer/export.js` fallback colours use Simform purple.
- The README motion-proof GIF and receipt (`docs/assets/archify-live-proof.*`) were rebuilt because they
  hash the regenerated gallery artifacts.
- The `compare architecture` delta page keeps its own dark theme and system monospace font.
**Why:** `docs/` pages embed the viewer but come from sources outside this repository; they are
not published by Simform. Rebranding the delta proof page is a separate piece of work.
**Reverse / extend:** re-render with `npm --prefix archify run render:examples`.

## D-15 Things downloaded to build this

- Azure icons V25: `arch-center.azureedge.net` (link read from the official page).
- Microsoft 365 icons: `go.microsoft.com/fwlink/?linkid=869455` (the page's "Download SVG icons").
- Entra icons (Oct 2023): `download.microsoft.com`.
- Fabric icons: `raw.githubusercontent.com/microsoft/fabric-samples/.../Icons.zip` (the page links the
  GitHub blob; the raw URL serves the same file).
- Dynamics 365 icons: `download.microsoft.com`.
- Inter 5.3.0: `npm pack @fontsource-variable/inter`.
Archive URLs and SHA-256 values are in `archify/icon-packs/SOURCES.md`. The sync script contacts
only Microsoft hosts and the Fabric samples repository.

## D-16 Known gaps and open items

- Not tried in a real SharePoint tenant (D-13).
- Full suite: 3,232 passed, 0 failed, 126 skipped (browser/Windows lanes). Of the Chrome-driven tests only
  `offline-font-browser`, `export-browser` and `viewer-chrome-layout` were run (all pass); the rest of
  `npm run test:browser` was not.
- Dark mode: `security` and `external` nodes look alike (D-04).
- Only architecture diagrams use the 48px gutter icon; the other four icon-capable types keep the 24px corner tile (D-09). Generic icons are inferred only for architecture diagrams (D-19).
- The toolbar preset still reads "Classic" (D-03).
- Icons for `explainer` pages and for `erd`, `tree`, `class`, `timeline`, `waterfall` are not supported
  because those types have no brand marks upstream.
- The Microsoft 365 page is archived by Microsoft; its links may change.
- Upstream merges will conflict in `viewer/viewer.css`, `viewer/template.source.html`,
  `archify/assets/template.html` (regenerate, do not hand-merge), `archify/SKILL.md` and
  `renderers/shared/brand-marks.mjs`.

## D-17 Azure connection labels follow Azure Architecture Center wording

**Decided:** edge labels in Azure diagrams are lowercase, present tense, active verb first, one to
three words, with no protocol on the edge. The example now reads `sends requests`, `authenticates`,
`routes traffic`, `serves static content`, `reads secrets`, `persists data`, `sends messages`,
`triggers worker`, `stores results` (was `HTTPS`, `sign in`, `route`, `static`, `secrets`, `SQL`,
`enqueue`, `trigger`, `write`). The vocabulary by relationship kind is in
`archify/references/azure-icons.md` ("Connection labels"), which the skill reads.
**Why:** the user asked for edge text to follow the Azure Architecture Center and its
architecture styles guide (N-tier, Web-Queue-Worker, Event-driven, Microservices). Those pages
describe relationships in active prose and leave most logical-diagram edges unlabelled; they use
verbs such as sends requests, routes traffic, persists data, communicates through a queue,
publishes and subscribes. The phrases are paraphrased, not copied.
**Caveats:** only four of the six style pages were read (Big data and Big compute were not),
secrets are not covered by those pages so `reads secrets` is plain wording, and the Architecture
Center is not a labelling standard, so this is a house style drawn from its language.
**How to reverse:** edit the labels in the example and the table in the reference; nothing in the
renderer depends on the wording.

## D-18 This repository is its own Claude plugin marketplace

**Decided:** `.claude-plugin/marketplace.json` at the repository root declares a marketplace
named `simform-archify` with one plugin, also `simform-archify`, whose `source` is `./archify`.
There is no `plugin.json`: the `archify/` folder holds `SKILL.md` at its root, which Claude loads
as a single skill, and the marketplace entry is the plugin manifest. Install with
`/plugin marketplace add SimformSolutionsPvtLtd/simform-archify` then
`/plugin install simform-archify@simform-archify`; Claude Desktop users add the same repository
from Customize > Plugins > Add > Add marketplace.
**Why:** end users should be able to install the skill in Claude Desktop. Adding it to the
`simform-brag` marketplace was tried and withdrawn (that PR was closed unmerged) in favour of a
marketplace that belongs to this repository.
**Caveats:** the plugin has no `version`, so installs track commits on the default branch. The
slash command name for a root-level single skill was not confirmed (check `/` autocomplete).
Running the skill inside Cowork's sandbox (Node 18+ and Chrome needed) was not tested. A test
install from a clean copy of the repository into an isolated config directory worked, and the
installed `bin/archify.mjs` ran.
**How to reverse:** delete `.claude-plugin/` and the README section. The Skills CLI install path
is unaffected.

## D-19 Generic components get Lucide line icons, inferred when `brand` is missing

**Decided:** a sixth icon pack, `generic` (49 icons, ids `generic-*`), holds [Lucide](https://lucide.dev)
line art (ISC licence, `lucide-static` 1.75.0) for components that are not Microsoft services:
users, browsers, API servers, workers, schedulers, gateways, queues, event buses, caches,
databases, storage, identity, secrets, monitoring and similar. It is selected through the same
`brand` field (`"brand": "queue"`), is listed by `archify brands`, and is refreshed with
`node scripts/sync-icon-packs.mjs --download --only generic` (the other packs are left as they are).
In an **architecture** diagram that already shows a Microsoft icon, a node with no `brand` gets a
generic icon inferred from its label and `type` (`renderers/shared/generic-icons.mjs`: ordered
keyword rules, then a fallback per node type). An explicit `brand` always wins. A node too narrow
for icon and label keeps no icon instead of failing validation. `SIMFORM_GENERIC_ICONS=off`
switches the inference off.
**Why:** end users said nodes such as API server and queue had no icons, so diagrams looked half
finished. The Azure packs have no icons for generic roles, and using an Azure product icon for a
generic role is what Microsoft's terms and D-08 forbid. Lucide is the icon set the Simform design
system names, and its ISC licence needs only the notice (shipped as `icon-packs/generic/TERMS-LICENSE`
and in THIRD_PARTY_NOTICES.md).
**Differences from the Microsoft packs:** generic icons are recoloured, deliberately. They are drawn
with `stroke="currentColor"` in the node type's own stroke colour on a tile that follows the theme
(`.brand-mark-line` in `viewer/viewer.css`), so they keep contrast in dark mode. Stroke is 1.75 in a
24-unit glyph, drawn at native size (24px) inside the 48px gutter tile. The Microsoft artwork is
still never altered.
**Caveats:** inference reads English words only; a node labelled in another language falls back to
its type icon. The keyword rules are a heuristic, so a surprising pick is fixed by setting `brand`.
Only architecture diagrams infer icons; other types accept an explicit generic `brand` but never
get one automatically. Icon choice was not reviewed by a designer.
**How to reverse:** delete the `generic` entry from `PACKS` in `sync-icon-packs.mjs`, run the sync
(or remove `icon-packs/generic/` and the catalogue entries), delete `generic-icons.mjs` and its call
in `brand-marks.mjs`. Setting `SIMFORM_GENERIC_ICONS=off` turns off only the automatic part.

## D-20 The skill asks which Azure architecture style to draw, defaulting to Microsoft's Microservices

**Decided:** before drawing an `architecture` diagram from a system description or a codebase, the
skill (`SKILL.md`, native diagram authoring step 1) asks once which style to follow, using the six
styles on the Azure Architecture Center's architecture styles guide: Microservices (default),
N-tier, Web-queue-worker, Event-driven, Big data, Big compute. A seventh option, "work it out from
the codebase", has the agent read the repository and choose the best style or a combination, and
say so before drawing. Details, the evidence table and the drawing shape per style are in
`archify/references/architecture-styles.md`. `examples/microservices-platform.architecture.json`
shows the default style with Azure and generic icons together.
**Why:** end users asked to be asked, with Microservices as the default and an option for the agent
to decide from the code.
**Caveats:** this is skill instruction, not code: whether the question is asked depends on the
agent following `SKILL.md`, and nothing in the CLI enforces or records the choice (it is written to
`meta.subtitle` by convention only). The six styles come from one reading of the guide (2026-11-04);
Microsoft may add or rename styles. The per-style drawing shapes are a house summary, not Microsoft's
diagrams. It was not tried with a real agent end to end.
**How to reverse:** delete the sentence in `SKILL.md` step 1 and `references/architecture-styles.md`.

## D-21 Viewer polish: sentence-case labels, no looping chrome, quiet legend counts

**Decided:** a polish pass on the standalone page, following the `unslop` and `modern-web-guidance`
skills but keeping the Simform brand (palette, Inter, light default) untouched. Changes in
`viewer/viewer.css` and `archify/locales/en.json`:
- Dock and level labels read `Route`, `Map`, `Lens`, `Read`, `Full`, `Auto` (were all caps).
- Twelve small-caps eyebrow and status labels (lens, passport, finder, guide, overview map) lose
  uppercase, wide tracking and 800 weight, and rise from 8px to 11px.
- The title dot, overview-map dot and motion button no longer pulse or breathe forever. Flow
  animation along edges, which explains direction, is unchanged.
- Legend counts are plain numbers instead of bordered pills. The keyboard focus ring on a legend
  entry is a thicker stroke, not a glow.
**Why:** end users said the page looked machine-made. Uppercase tracked micro-labels, endless
pulsing and counts in pills are the common tells.
**Not changed, and why:** the dotted canvas (the design system's network motif), the 700-weight
title (the design system sets h1 at 700), the glass-blur dock, the corner node-type glyph (it keeps
type from relying on colour alone, WCAG 1.4.1), and the other locales' strings (not reviewed).
Diagram text inside nodes is still small at fit-to-screen zoom.
**Caveats:** checked by screenshot in light and dark and by the test suites, not by a designer or
with real users. The in-page copy and spacing of the lens, passport and finder panels were not
audited line by line.
**How to reverse:** revert the CSS and locale edits in this entry's commit and run
`node scripts/generate-viewer.mjs`.

## D-22 More built-in brand marks, drawn in the 48px gutter in architecture diagrams

**Decided:** eleven marks join the built-in catalogue (107 to 118): `qdrant`, `milvus`, `neo4j`,
`langchain`, `langgraph`, `crewai`, `nginx`, `graphql`, `celery` (from Simple Icons 16.28.0, as the
existing marks are), plus `llamaindex` (single-colour path from lobe-icons, MIT) and `agno` (the
symbol from Agno's own logo file, translated into a square viewBox). PostgreSQL, Redis, MongoDB,
React, Python and TypeScript were already there. Built-in and digest-pinned captured marks now use
the same 48px left-gutter layout as the Azure icons in **architecture** diagrams; other diagram types
are unchanged (16px corner badge). A node too narrow for the gutter and its label keeps the small
badge instead of failing validation, so diagrams written earlier still render. Two generic icons were
added (`generic-agent`, `generic-vector-database`), and `microsoft agent framework` is an alias of
`generic-agent`.
**Why:** end users asked for icons for common services and frameworks. Most already existed, but at
16px beside 48px Azure icons they looked like an afterthought, which was the original complaint.
**Caveats:** Microsoft Agent Framework has no logo I could find (no vector in its repository or on
its docs), so it shows a generic robot glyph, not a Microsoft mark; if Microsoft publishes one, add it
to the Microsoft packs. The Agno symbol was cut from its wordmark by reading path coordinates, not
from a published standalone icon, and was not checked against Agno's brand guidelines. The LlamaIndex
mark comes from a third-party icon set, not LlamaIndex's own files (their favicon is a raster
image). Single-colour marks are drawn in their recorded colour on a white tile (LlamaIndex and Agno in
black). Simple Icons' CC0 licence covers its collection, not every trademark.
**How to reverse:** remove the eleven entries from `archify/brand-marks/catalog.json` and run
`npm --prefix archify run generate:brand-marks`; delete the `placement` additions in
`brand-marks.mjs` (`attachPackMark` stays) to return built-in marks to the 16px badge.

## D-23 Upstream's website, proof gallery and Pages/Cloudflare deploys are removed

**Decided:** deleted `docs/index.html`, `docs/guide.html`, `docs/start.html`, `docs/gallery.html`,
`docs/gallery/` (its rendered artifacts, sources and manifest), `docs/llms.txt`, the whole `website/`
Astro project, the generators and templates behind them (`scripts/build-gallery.mjs`,
`build-guide.mjs`, `build-start.mjs`, `copy-site-assets.mjs`, `site-copy.mjs`, `gallery-template.html`,
`guide-template.html`, `start-template.html`), the README demo GIF build (`scripts/build-readme-showcase.mjs`,
`docs/assets/archify-live-proof.*`), the `website`, `deploy-pages` and `deploy-cloudflare` jobs in
`.github/workflows/ci.yml`, and the tests that only covered those (gallery, guide, start, landing, site
language, copy-site-assets, cloudflare, proof-aperture, README showcase). Shared tests and
`scripts/check-release-identity.mjs` lost their site assertions; `test/golden.mjs` no longer checks the
landing page version. The root `llms.txt` stays.
**Why:** Simform does not use upstream's marketing site, and keeping it meant regenerating several
hundred KB of pages and artifacts on every viewer or renderer change.
**Caveats:** `docs/` still holds upstream's other prose, evidence and case files, the `docs/assets`
images the translated READMEs use, and `docs/skill-updates/` (the update manifest). `README_ZH.md`,
`README_JA.md` and `README_KO.md` may link to pages that no longer exist. `scripts/ci-scope.mjs` still
classifies paths for a `website` scope that no job consumes. `.github/workflows/` contributor-card and
star-history workflows and the `community/`, `benchmarks/`, `experiments/` and `tools/` folders are
untouched. The release workflow was not checked for site steps. This removal was done by running the
suite until it passed, not by tracing every reference, so stray mentions in prose may remain.
**How to reverse:** `git revert` the commit that carries this entry (or restore the paths from the
previous commit); nothing else depended on them.

## D-24 Upstream-only docs, evidence, benchmarks, community and integrations are removed

**Decided:** deleted the narrative and marketing material (`docs/article-*` and images, `docs/assets`,
`experiments/`, `journal/`, `docs/research`, `docs/reviews`, the acceptance and design notes in `docs/`,
`ROADMAP.md`, and `README_ZH.md`, `README_JA.md`, `README_KO.md`); the evidence and case studies
(`docs/cases`, `docs/evidence`, `docs/reading-evidence`, `docs/issue-52-visual-evidence`, `docs/specs`
except `docs/specs/explainer/examples`, `benchmarks/`, `community/`); and the other-agent integrations
and automation (`integrations/`, `tools/`, the contributor-cards, contributors, star-history and DSH
workflows, and the scripts and tests that served them). The upstream showcase issue template went too.
Tests that only covered these were deleted; shared tests and `scripts/check-release-identity.mjs` lost
their translated-README, roadmap and integration assertions.
**Why:** Simform uses none of it, and each upstream README, benchmark and case study is something
a reviewer would otherwise have to keep current.
**Kept on purpose:** `docs/simform/`, the authoring cookbooks, `docs/releases`, `docs/skill-updates`,
`CHANGELOG.md`, `PRODUCT.md`, `DESIGN.md`, the root `examples/` (goldens used by tests) and
`docs/specs/explainer/examples` (fixtures for the explainer layout test).
**Caveats:** the DeepSeek and Hermes adapters are gone, so the skill is no longer shipped for those
agents from this repository; `test/path-boundary-contract.test.mjs` may still list `integrations/` paths;
`scripts/ci-scope.mjs` still has classification rules for removed paths. `CHANGELOG.md` and a few
prose mentions still name the removed material. Done by running the suite until it passed, so stray
references may remain.
**How to reverse:** `git revert` the commit that carries this entry.

## D-25 AI-stack logos live in an `ai` icon pack, and architecture diagrams must be grouped by layer

**Decided:** a seventh icon pack, `ai` (20 colour logos, ids `ai-*`), covers what the built-in marks
and the Azure packs lacked: Amazon Bedrock, Google Vertex AI, Cohere, Groq, xAI, Together AI, Fireworks AI,
Cerebras, SambaNova, NVIDIA (LLM providers); Pinecone, Weaviate, Chroma (vector stores); DSPy,
Pydantic AI, Haystack, OpenHands (agent frameworks); MCP, CopilotKit, Langfuse (agent tooling). Files are
fetched one by one from version-pinned jsDelivr URLs (lobe-icons 1.106.0 MIT, gilbarbara/logos at commit
`875d71c`, CC0, Simple Icons 16.28.0 CC0) by `sync-icon-packs.mjs --download --only ai`; the catalogue
records each file's digest and origin. A pack, not `brand-marks/catalog.json`, because built-in marks hold one
path in one colour and Chroma, Weaviate and the Vertex AI logo are multi-colour. FAISS, AutoGen, Semantic
Kernel and Microsoft Agent Framework have no logo in any of those sources, so their names resolve to
the generic vector-database and agent icons (`generic-*` aliases).
`pgvector` is documented as the PostgreSQL mark with the label `pgvector`, because it is a PostgreSQL extension and
has no logo of its own. The skill gained a mandatory rule, in `SKILL.md` and `references/architecture-layers.md`:
architecture diagrams are grouped by layer (one labelled `region` frame per layer, members on a grid, layers in
flow order, one box per supported provider with its own logo, one adapter node receiving the layer's edges, planned
items tagged). `examples/ai-agent-platform.architecture.json` is the model.
**Why:** an end user making a ThoughtMesh-Mini diagram had to ask, one message at a time, for provider and
vector-store logos, and then for each provider in its own box inside a labelled "LLM Providers" and
"Vector Stores" frame, as the archify.si agent-tool-call workflow organises its lanes. That is now the default.
**Caveats:** `currentColor` in Groq, xAI, Cerebras and MCP and the missing fill in Haystack were replaced with the
brand colour or black, so they stay visible on a white tile in dark mode (the only edit to any file). The logos
are trademarks; the Simple Icons, gilbarbara and lobe-icons licences cover their collections, not the marks. The
layer rule is skill instruction: nothing in the CLI checks it, and it was not tried with an agent end to end. The
example was checked by `finalize` and by screenshots in light and dark, not by a designer. Built-in marks need nodes at
least 190px wide to get the 48px gutter, which limits how many fit across the 1240px canvas.
**Not done:** `archify.zip` was not rebuilt (it needs official Node 22 with bundled zlib `1.3.1-e00f703`, which was not on
this machine), so the packaged skill still lacks the `ai` pack and the layer rule, and `test/skill-installation.test.mjs`
("distributed ZIP carries the same valid Skill frontmatter as source") fails until it is rebuilt with `scripts/build-zip.sh`
after the new files are committed. Editing `THIRD_PARTY_NOTICES.md` (embedded in every artifact) meant re-rendering the
checked-in examples, the Checkout compare page and the root architecture examples.
**How to reverse:** delete the `ai` entry from `PACKS` in `sync-icon-packs.mjs`, remove `icon-packs/ai/` and its catalogue
entries (re-run the sync), and delete `references/architecture-layers.md`, the example and the `SKILL.md` bullets.
