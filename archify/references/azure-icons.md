# Azure and Microsoft icons

Simform Archify ships 1,097 official Microsoft icons in `icon-packs/`, plus the generic and AI-stack packs below. Use them
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

3. No match: use a generic icon (below) or omit `brand`. Never substitute a
   similar-looking Microsoft icon, and do not use a Microsoft icon for a product
   that is not that Microsoft service.
   `validate` fails with the closest ids when a `brand` value is unknown.

## Generic icons

Not every node is a Microsoft service. Users, API servers, queues, caches, workers
and gateways have no Azure icon, and a diagram where only some nodes carry an icon
looks unfinished. The `generic-` pack (49 Lucide line icons, ISC licence) covers
them. Use it through the same `brand` field:

```json
{ "id": "jobs", "type": "messagebus", "label": "Job queue", "brand": "queue",
  "pos": [490, 300], "size": [210, 76] }
```

| Kind | Ids (aliases work too) |
| --- | --- |
| People and clients | `generic-user`, `generic-users`, `generic-admin`, `generic-browser`, `generic-mobile-app`, `generic-desktop-app`, `generic-dashboard` |
| Compute | `generic-api-server`, `generic-microservice`, `generic-worker`, `generic-scheduler`, `generic-batch-job`, `generic-container`, `generic-serverless-function` |
| Networking | `generic-gateway`, `generic-load-balancer`, `generic-network`, `generic-internet` |
| Data | `generic-database`, `generic-cache`, `generic-object-storage`, `generic-file-storage`, `generic-data-warehouse`, `generic-data-lake`, `generic-vector-database`, `generic-search-index` |
| Messaging | `generic-queue`, `generic-event-bus`, `generic-event-stream`, `generic-webhook`, `generic-email`, `generic-notification`, `generic-chat` |
| Security | `generic-identity-provider`, `generic-secrets`, `generic-firewall`, `generic-security` |
| Operations and business | `generic-monitoring`, `generic-logging`, `generic-ci-cd`, `generic-configuration`, `generic-payments`, `generic-analytics`, `generic-agent`, `generic-ml-model`, `generic-etl`, `generic-iot-device`, `generic-external-api`, `generic-cloud-service` |

- **Prefer the Azure icon** when the user names an Azure service. `queue` alone means
  the generic icon; `azure-storage-queue` or `service bus` mean Azure's.
- **They take the node's colour.** Unlike the Microsoft artwork, generic icons are
  line art drawn in the node type's own stroke colour, on a tile that follows the
  theme. The Microsoft icons are never recoloured.
- **Automatic fallback.** In an architecture diagram that already shows a Microsoft
  icon, a node without `brand` gets a generic icon inferred from its label and type
  (`Job queue` gets the queue, `Users` the people icon). An explicit `brand` always
  wins. A node too narrow for an icon and its label keeps none. Set
  `SIMFORM_GENERIC_ICONS=off` to switch the inference off.
- **Do not use a generic icon for an Azure service** that has its own.

### Named technologies

A technology that is not an Azure service but has a built-in brand mark uses that mark
through `brand`: PostgreSQL, MySQL, MongoDB, Redis, Qdrant, Milvus, Neo4j, Kafka, NGINX,
React, Python, TypeScript, GraphQL, Celery, LangChain, LangGraph, LlamaIndex, Agno, CrewAI,
and the rest listed by `node bin/archify.mjs brands`. In architecture diagrams they draw in
the same 48px gutter as the Azure icons (a node too narrow for that keeps the small corner
badge). Microsoft Agent Framework has no published logo file, so it uses
`generic-agent` (`"brand": "microsoft agent framework"` resolves to it).

### AI and data-stack logos

A seventh pack, `ai` (ids `ai-*`, 20 logos), holds the colour logos of LLM providers,
vector stores and agent frameworks that Simform diagrams show most. Use them through
`brand`, with the provider's own name as the label. The same lookup also reaches the
Azure icons and the built-in marks, so use this table instead of guessing:

| Kind | `brand` value (the logo that is drawn) | No logo: use instead |
| --- | --- | --- |
| LLM providers | `openai`, `anthropic`, `google-gemini`, `mistral-ai`, `deepseek`, `qwen`, `meta`, `ollama`, `openrouter`, `hugging-face`, `perplexity`, `replicate`; `azure-openai`, `azure-ai-foundry` (Azure pack); `ai-bedrock`, `ai-vertex-ai`, `ai-cohere`, `ai-groq`, `ai-xai`, `ai-together-ai`, `ai-fireworks-ai`, `ai-cerebras`, `ai-sambanova`, `ai-nvidia` | `generic-ml-model` |
| Vector stores | `qdrant`, `milvus`, `ai-pinecone`, `ai-weaviate`, `ai-chroma`, `elasticsearch`, `opensearch`, `redis`, `mongodb`, `neo4j`; `azure-cognitive-search` (Azure AI Search), `azure-cosmos-db`; `postgresql` for pgvector (it is a PostgreSQL extension, so label the node `pgvector`) | `generic-vector-database` (`faiss` resolves to it) |
| Agent frameworks | `langchain`, `langgraph`, `llamaindex`, `crewai`, `agno`, `ai-dspy`, `ai-pydantic-ai`, `ai-haystack`, `ai-openhands`; `dify`, `n8n` | `generic-agent` (`autogen`, `semantic kernel` and `microsoft agent framework` resolve to it) |
| Agent tooling | `ai-mcp` (Model Context Protocol), `ai-copilotkit`, `ai-langfuse` | `generic-gateway`, `generic-monitoring` |

- Search with `node bin/archify.mjs brands "<name>" --json`. A name with no mark and no
  generic alias, for a technology the user wants shown with its real logo, goes through
  `brands capture <official url>` (see [Brand marks](brand-marks.md)); never borrow
  another company's logo.
- AutoGen, Semantic Kernel, Microsoft Agent Framework and FAISS have no logo file in any
  source Simform ships, so they show the generic icon for their role.
- The logos come from lobe-icons (MIT), gilbarbara/logos (CC0) and Simple Icons (CC0);
  `icon-packs/SOURCES.md` records each file's origin. They are trademarks of their owners:
  name the product beside the logo and do not imply endorsement.
- Single-colour sources (Groq, xAI, Cerebras, Haystack, MCP) had `currentColor` replaced by
  the brand colour or black so they stay visible in dark mode. Shapes are never edited.
- Lay these nodes out by layer: [Architecture layers](architecture-layers.md).

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
- **One icon per node.** Microsoft services get their own icon; everything else gets
  a generic one (see above).
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
