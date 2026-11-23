# Architecture layers (mandatory)

Every `architecture` diagram is organised by layer. A reader should see the
layers first and the boxes second, the way the workflow example
(`examples/agent-tool-call.workflow.json`) shows its swim lanes and phases. Do not
wait for the user to ask for this: a flat canvas of unrelated boxes is a defect.

The model example is `examples/ai-agent-platform.architecture.json`. Read it
with the architecture example before you place anything.

## The rules

1. **Name the layers from the system.** Typical layers are Channels, Edge and
   identity, Application services (or Agent runtime), Integrations and tools,
   LLM providers, Vector stores, Data stores, Messaging, Observability. Use the
   words the user or the code uses. Skip a layer the system does not have.
2. **One layer, one labelled frame.** Wrap each layer in a `region` boundary
   whose `label` is the layer name (sentence case, no "Layer" suffix). A layer's
   frame wraps every member of that layer and nothing else. Use `security-group`
   only for a real network or trust scope inside a layer.
3. **Members share a grid.** Inside a frame, place nodes on a row or in a
   rectangular block: same size, same gaps, aligned edges. Never scatter them.
4. **Layers follow the flow.** Order the frames along the main journey, top to
   bottom (or left to right), so entry points come first and data stores last.
   Draw edges between neighbouring layers. If an edge would cross a layer that
   is not its neighbour, reorder the layers or place the two layers side by
   side before you route around it.
5. **A set of supported options is one box per option.** LLM providers, vector
   stores, agent frameworks, queues, cloud providers and similar lists go inside
   one labelled frame with a separate node for each option, each carrying its
   own logo. Never fold the list into a single node's sublabel.
6. **Do not wire every option.** One adapter or router node at the start of the
   frame receives the layer's edges (`Model adapters`, `Store adapters`).
   Individual provider boxes stay unconnected unless the user asks to show
   which one a given component uses.
7. **Only draw what exists.** Options that are planned, not shipped, get a
   `tag` such as `planned`, or stay in a card. A diagram for sales or a customer
   must not show a roadmap item as a supported capability.

## Sizes that work

- Node size at least `[200, 76]`. Built-in logos (OpenAI, Anthropic, Qdrant,
  LangGraph, LlamaIndex and the other marks from `brands`) only get the 48px
  gutter on nodes 190px wide or more; narrower nodes fall back to a 16px corner
  badge that looks unfinished next to the others.
- Keep the whole canvas within 1240px wide. Three 200px columns plus gaps fill
  about 650px, so put a long list in two or three columns per frame and stack
  rows, or place two frames side by side (the example does).
- Leave about 90px between nodes that share a labelled edge, and about 60px
  between two side-by-side frames.
- Short sublabels (about 16 characters). Longer ones shrink below the desktop
  readability floor and fail `finalize`.

## Other diagram types

- **Workflow:** layers are `lanes`, steps are `phases`, and related nodes share a
  `group`. Follow the example for the exact fields.
- **Data flow, sequence, lifecycle:** keep their own structures, and name
  the groups after the layers they cross.

## Logos for the AI stack

Every provider, store and framework node gets its logo through `brand`. The ids
and the logo that exists for each are in
[Azure icons: AI and data-stack logos](azure-icons.md#ai-and-data-stack-logos).
