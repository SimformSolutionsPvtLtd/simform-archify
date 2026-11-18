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
- Only architecture diagrams use the 48px gutter icon; the other four icon-capable types keep the 24px corner tile (D-09).
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
