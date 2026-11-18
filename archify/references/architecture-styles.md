# Architecture styles

Ask which style an architecture diagram should follow before drawing it. The
styles are the six on the Azure Architecture Center's
[architecture styles guide](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/).
The summaries below are paraphrased from it, not copied.

## The question

Ask once, at the start of an `architecture` request, unless the user already
named a style or said to skip the question. Offer these choices, with
Microservices first because it is the default:

1. **Microservices** (default)
2. **N-tier**
3. **Web-queue-worker**
4. **Event-driven**
5. **Big data**
6. **Big compute**
7. **Work it out from the codebase**: you read the repository and pick the best
   style, or a combination, and say which and why

Keep the question short and put the choices in one message. If the tool you
have for asking users questions allows several answers, allow several: a
platform can be microservices with event-driven messaging.

Do not ask when the user asked for something that is not a style choice:
a deployment diagram, a network diagram, a single-service view, or an update to
an existing diagram. Keep that diagram's current style. Do not ask for Mermaid
conversion or a frozen candidate either.

If the user does not answer or says "you choose", use Microservices when there is
no codebase to read, and "work it out from the codebase" when there is one.

## Work it out from the codebase

Read the repository first (see [Repository authoring](repository-authoring.md)),
then decide from evidence. Tell the user the result in one or two sentences before
you draw, so they can correct it. Signals worth checking:

| Evidence in the repository | Points to |
| --- | --- |
| One deployable with presentation, business and data layers; a single database | N-tier |
| A web app plus a queue consumer, or HTTP handlers that enqueue slow work | Web-queue-worker |
| Several independently deployed services, each with its own data store and API; a gateway; per-service pipelines | Microservices |
| Event or topic names, handlers that subscribe, a broker (Service Bus, Event Hubs, Event Grid, Kafka), producers that do not know their consumers | Event-driven |
| Ingestion jobs, a lake or warehouse, batch and stream processing, notebooks, reporting | Big data |
| Many independent or tightly coupled compute tasks, job schedulers, Batch pools, simulation or rendering code | Big compute |

Most real systems mix two. Name the dominant style and the second one, for
example "Microservices with event-driven messaging", and draw both: the
services as the main structure, the broker and topics where they connect.

## How each style looks in a diagram

Use these as the shape of the picture, then replace the parts with what the user
actually described. Do not add a component the user's system does not have just
to complete a pattern.

| Style | What to draw | Typical node kinds |
| --- | --- | --- |
| Microservices | A client, an API gateway, several small services each with its own data store, a message broker between them, identity, and shared observability | gateway, service (`backend`), database per service, event bus (`messagebus`), identity (`security`) |
| N-tier | Layers left to right or top to bottom: presentation, business logic, data access, database, with a cache beside the data tier; each layer calls only the one below | browser, web tier, business tier, cache, database |
| Web-queue-worker | A client, a CDN and static store, a web front end, a queue, a worker, a database and optionally a cache | browser, CDN or storage, web app, queue, worker, database, cache |
| Event-driven | Producers, an ingestion broker, channels or topics, and several consumers that each react on their own | producer service, event bus or stream, consumers, a store per consumer |
| Big data | Sources, ingestion, a data lake, batch and stream processing, an analytical store, reporting, and an orchestrator across them | source, event stream, data lake, ETL, data warehouse, analytics |
| Big compute | Input storage, a scheduler, a pool of parallel tasks (or tightly coupled groups with messaging), output storage | storage, scheduler, worker pool, storage |

Relationship wording for each is in
[Azure icons: connection labels](azure-icons.md#connection-labels). Put the chosen
style in `meta.subtitle`, for example "Microservices on Azure", so the diagram says
what it is.

## Icons

Give every node an icon: the Azure service when the user named one, a generic icon
otherwise. See [Azure icons](azure-icons.md#generic-icons).
