# Third-party notices

Archify includes optional vector data for third-party brand marks. These marks
are provided only to identify technologies and services in user-authored
diagrams. Their inclusion does not imply sponsorship, endorsement, partnership,
or affiliation with Archify.

Archify's license and historical MIT grants are described in LICENSE, NOTICE,
and LICENSE-MIT. The software license does not
replace the copyright licenses, trademark policies, or brand guidelines that
apply to third-party marks. Users are responsible for confirming that their
particular use is permitted.

## Lucide

The `generic` icon pack in `archify/icon-packs/generic/` is line art copied
unchanged from [lucide-static 1.75.0](https://www.npmjs.com/package/lucide-static/v/1.75.0)
and used for components that are not Microsoft services. Lucide is licensed
under the ISC License, Copyright (c) 2026 Lucide Icons and Contributors; a few
glyphs derive from the Feather project (MIT). The full licence text ships as
`archify/icon-packs/generic/TERMS-LICENSE`.

## LlamaIndex and Agno marks

The built-in `llamaindex` mark is the single-colour glyph from
[lobe-icons](https://github.com/lobehub/lobe-icons) (`@lobehub/icons-static-svg`
1.103.0, MIT License, Copyright (c) LobeHub). The built-in `agno` mark is the
symbol taken from Agno's own logo file linked in the README of
[agno-agi/agno](https://github.com/agno-agi/agno), translated into a square
viewBox with no other change. Both are trademarks of their owners, shown only to
identify the technology in a diagram, with no implied endorsement.

## Simple Icons

Most of the built-in vector paths and their metadata were generated from
[Simple Icons 16.28.0](https://github.com/simple-icons/simple-icons/tree/16.28.0).
Simple Icons makes its collection work available under
[CC0 1.0 Universal](https://github.com/simple-icons/simple-icons/blob/16.28.0/LICENSE.md).

As Simple Icons explains in its
[disclaimer](https://github.com/simple-icons/simple-icons/blob/16.28.0/DISCLAIMER.md),
CC0 for the collection does not mean that every underlying icon is CC0. License
and brand-guideline metadata may be incomplete or change over time. The absence
of an individual license entry is not a grant of permission.

Archify embeds the selected icons as vector-path data and may render them in a
user-selected color. The following individual licenses were recorded in the
pinned Simple Icons 16.28.0 metadata:

| Mark | Recorded source | Recorded license | Archify treatment |
|---|---|---|---|
| Angular | [Angular press kit](https://angular.dev/press-kit) | [`CC-BY-4.0`](https://creativecommons.org/licenses/by/4.0/) | Embedded as vector-path data; color may be changed by the authored diagram. |
| Apache Airflow | [Apache logos](https://apache.org/logos) | [`Apache-2.0`](https://www.apache.org/licenses/LICENSE-2.0) | Embedded as vector-path data; Apache trademarks remain subject to the [ASF trademark policy](https://www.apache.org/foundation/marks/). |
| Apache Kafka | [Apache logos](https://apache.org/logos) | [`Apache-2.0`](https://www.apache.org/licenses/LICENSE-2.0) | Embedded as vector-path data; Apache trademarks remain subject to the [ASF trademark policy](https://www.apache.org/foundation/marks/). |
| .NET | [.NET brand repository](https://github.com/dotnet/brand/blob/c7d0f51b8ec59531332d05fb27a5b758a7a3d689/logo/dotnet-logo.svg) | [`CC0-1.0`](https://creativecommons.org/publicdomain/zero/1.0/) | Embedded as vector-path data; color may be changed by the authored diagram. |
| JavaScript | [JS community logo](https://github.com/voodootikigod/logo.js/blob/1544bdeed6d618a6cfe4f0650d04ab8d9cfa76d9/js.svg) | [`MIT`](https://github.com/voodootikigod/logo.js/blob/1544bdeed6d618a6cfe4f0650d04ab8d9cfa76d9/LICENSE) | Embedded as vector-path data; color may be changed by the authored diagram. |
| Jenkins | [Jenkins artwork source](https://get.jenkins.io/art/) | [`CC-BY-SA-3.0`](https://creativecommons.org/licenses/by-sa/3.0/) | Embedded as vector-path data; color may be changed by the authored diagram. Jenkins retains its trademark rights. |
| Rust | [Rust project](https://www.rust-lang.org) | [`CC-BY-SA-4.0`](https://creativecommons.org/licenses/by-sa/4.0/) | Embedded as vector-path data; color may be changed by the authored diagram. See the [Rust media guide](https://www.rust-lang.org/policies/media-guide). |
| Vue.js | [Vue logo source](https://github.com/vuejs/art/blob/a1c78b74569b70a25300925b4eacfefcc143b8f6/logo.svg) | [`CC-BY-NC-SA-4.0`](https://creativecommons.org/licenses/by-nc-sa/4.0/) | Embedded as vector-path data; color may be changed by the authored diagram. The non-commercial and share-alike conditions remain applicable; see the [Vue artwork terms](https://github.com/vuejs/art/blob/a1c78b74569b70a25300925b4eacfefcc143b8f6/README.md). |

The source, guideline, and known license fields for every packaged mark are
preserved in `renderers/shared/generated-brand-marks.mjs`.

## OpenAI mark

The OpenAI vector path is recorded from the
[OpenAI brand guidelines](https://openai.com/brand/), not from Simple Icons.
Use remains subject to those current guidelines and any applicable trademark
rights. Its inclusion does not state or imply endorsement by OpenAI.

## Inter

Delivered viewer artifacts embed the Inter variable font
subsets distributed by Fontsource (`@fontsource-variable/inter` 5.3.0): the
latin and latin-ext subsets. For characters covered by these subsets, font
selection does not depend on a network request or a locally installed copy.
Uncovered characters (including Cyrillic, Greek, Vietnamese and CJK) still use
the system fallback stack; browser and operating-system rasterization can differ.
Inter is maintained at [github.com/rsms/inter](https://github.com/rsms/inter)
and is distributed under the SIL Open Font License 1.1. The complete license
text is preserved in `assets/Inter-OFL.txt` in the packaged Skill and
in the font CSS carried by standalone HTML and SVG exports.

## Microsoft icon packs

The Simform fork ships Azure, Microsoft 365, Microsoft Entra, Microsoft Fabric
and Dynamics 365 icons in `icon-packs/`. They are unmodified copies of the
official downloads recorded, with source URLs and archive digests, in
`icon-packs/SOURCES.md`. Microsoft permits these icons in architecture diagrams,
training materials and documentation; it does not permit altering the artwork or
using the icons to represent another product or service. The terms shipped with
each archive are kept next to the icons as `TERMS-*` files. The Fabric set is
MIT-licensed (`@fabric-msft/svg-icons`, Copyright Microsoft Corporation).
Microsoft, Azure, Entra, Fabric, Dynamics 365 and Microsoft 365 names and logos
remain the property of Microsoft Corporation; their appearance in a diagram
does not imply endorsement by or affiliation with Microsoft.

## Pele

The explainer renders Mermaid chart fences with an unmodified subset of
[Pele 1.3.0](https://github.com/obsidianmd/pele), copyright (c) 2026 kepano,
distributed under the MIT License. The subset and its license text are in
`explainer/vendor/pele/` in the packaged Skill. Charts are rendered to static
SVG when a page is built; delivered pages contain no Pele code.

## No additional rights granted

Brand names, logos, and trademarks remain the property of their respective
owners. This notice records provenance and known terms; it does not grant rights
that Archify does not hold, and it does not state that every packaged mark has
been cleared for every commercial, promotional, or redistributive use.
