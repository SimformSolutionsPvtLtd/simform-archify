# Azure and Microsoft icons

Simform Archify ships 1,097 official Microsoft icons in `icon-packs/`. Use them
when a diagram names real Azure or Microsoft services. They go on a node through
the same `brand` field as any other brand mark; the node's semantic `type`,
colour, label and relationships stay authoritative.

| Pack | Prefix | Contents |
| --- | --- | --- |
| Azure | `azure-` | 639 service icons (compute, networking, databases, AI, security, ...) |
| Microsoft 365 | `m365-` | 360 product-coloured glyphs (SharePoint, Teams, Project, Planner, generic) |
| Microsoft Entra | `entra-` | Entra ID, Verified ID, Private/Internet Access, Workload ID, Governance |
| Microsoft Fabric | `fabric-` | 75 item and product icons (lakehouse, pipeline, Power BI, ...) |
| Dynamics 365 | `d365-` | 16 apps and the product family |

## Pick an icon

1. Search by the service name the user used:

   ```bash
   node bin/archify.mjs brands "key vault" --json
   ```

2. Put the returned `id` (or any listed alias such as `"aks"`, `"app service"`,
   `"azure sql"`, `"front door"`, `"entra"`) in the node:

   ```json
   { "id": "kv", "type": "security", "label": "Key Vault", "brand": "key vault",
     "pos": [490, 120], "size": [210, 76] }
   ```

3. No match: omit `brand`. Never substitute a similar-looking icon, and do not
   use a Microsoft icon for a product that is not that Microsoft service.
   `validate` fails with the closest ids when a `brand` value is unknown.

## Rules that keep diagrams correct

- **Label with the service name.** Microsoft's terms ask for the product name next
  to its icon: `label` is the service ("Key Vault", "App Service"), `sublabel` is
  its role in this system.
- **Never alter the artwork.** The renderer scales icons uniformly and never
  crops, flips, rotates, distorts or recolours them. Do not ask for that.
- **Give the node room.** On architecture diagrams the icon is 48px in a left gutter
  and the label is left-aligned beside it: size Azure nodes about 210x76 or larger
  (`"size": [210, 76]`) and leave at least 90px between columns so connection labels
  fit. A node too narrow for its label fails validation with a `brand top rail`
  message; widen it or shorten the label. Workflow, sequence, data-flow and lifecycle
  diagrams keep a 24px corner icon, so size those nodes at least 160px wide.
- **One icon per service node.** Use plain nodes (no `brand`) for users, networks
  and anything that is not a Microsoft service.
- **Pick `type` by role,** not by icon: `frontend` clients and UIs, `backend`
  compute (App Service, Functions, AKS), `database` data stores, `cloud` edge and
  platform services (Front Door, Storage, CDN), `security` identity and secrets
  (Entra ID, Key Vault, Defender), `messagebus` queues and events (Service Bus,
  Event Hubs, Event Grid), `external` people and outside systems.
- **Boundaries** are `region` or `security-group` only: use `region` for an Azure
  region or subscription, `security-group` for a VNet, subnet or NSG scope.
- Variants share names (for example `azure-sql-database` vs `azure-sql-managed-instance`):
  check `brands` output rather than guessing.

## Connection labels

Word relationship labels the way the Azure Architecture Center describes how
components talk to each other (the
[architecture styles guide](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/)
and its N-tier, Web-Queue-Worker, Event-driven and Microservices pages). The
phrases below are paraphrased from those pages, not copied.

- Lowercase, present tense, active verb first, one to three words: `routes traffic`,
  not `Route` or `Traffic is routed`. Say what the source does to the target.
- Do not put a protocol or port on an edge (`HTTPS`, `SQL`). Put it in the target's
  `sublabel` or a card if it matters.
- Match the relationship kind:

| Relationship | Label | Style it comes from |
| --- | --- | --- |
| Client to front end or gateway | `sends requests`, `connects to` | Web-Queue-Worker, Microservices |
| Gateway or load balancer to compute | `routes traffic`, `forwards requests`, `distributes requests` | N-tier, Microservices |
| CDN or storage to client | `serves static content` | Web-Queue-Worker |
| Compute to data store | `persists data`, `reads data`, `stores results`, `stores session state` | Microservices, Web-Queue-Worker |
| Compute to cache | `reads cache` | Web-Queue-Worker |
| Front end to queue | `sends messages`, `queues work` (dashed: asynchronous) | Web-Queue-Worker |
| Queue to worker | `triggers worker`, `delivers messages` | Web-Queue-Worker, Event-driven |
| Producer to broker or topic | `publishes events` | Event-driven, Microservices |
| Broker to consumer | `delivers events`, `broadcasts events` | Event-driven |
| Service to service | `calls API`, `sends commands` | Microservices |
| User or service to identity provider | `authenticates` | Web-Queue-Worker, Microservices |
| Service to secret store | `reads secrets` | not covered by the style pages; plain wording |

- Keep labels short enough for the gap between nodes (about 90px fits
  `triggers worker`). A label that does not fit fails validation: widen the gap
  rather than shortening to a bare noun.
- Use Azure product names in full on nodes (`Azure SQL Database`, `Azure Service Bus`)
  when the width allows; the label stays the short service name.

## Refresh or extend the packs

`node scripts/sync-icon-packs.mjs --download` re-reads Microsoft's pages, fetches
the latest archives, and rewrites `icon-packs/` and `catalog.json` (the Azure
archive version is discovered from the page). Add human-friendly names to
`icon-packs/aliases.json` and rerun. `node scripts/sync-icon-packs.mjs --check`
verifies digests and the SVG safety rules with no network. Source URLs and
archive hashes are in `icon-packs/SOURCES.md`.
