## Automations improvement plan

Three focused upgrades, all frontend (no schema changes).

### 1. Langflow-style Flow Builder (biggest change)

Replace the current `ModernFlowEditor` with a **canvas-based, node-graph editor** inspired by Langflow:

- Add `reactflow` (`@xyflow/react`) — battle-tested node editor used by Langflow itself.
- New file `src/components/automations/LangflowEditor.tsx`:
  - Infinite pannable/zoomable canvas with dotted grid background (dark glassmorphism theme).
  - Left **Node Palette** sidebar: collapsible categories (Triggers, Delays, Conditions, Actions) with drag handles. Search box at top.
  - **Custom node components** for each type (trigger / delay / condition / action) — rounded glass cards with colored left border, icon, title, subtitle, input/output handles (dots) on left/right edges.
  - Smooth bezier edges with arrowheads; animated dashed line when an automation is active.
  - **Right Inspector panel**: opens on node click, contextual config (same fields as today's `NodeConfigPanel` but inline).
  - Top toolbar: Undo / Redo, Auto-layout (dagre), Fit view, Zoom %, Save, Test run.
  - Mini-map bottom-right.
  - Keyboard shortcuts: `Del` remove node, `Cmd+Z` undo, `Space+drag` pan, `Cmd+S` save.
- Update `Automations.tsx` and `AutomationCreate`/edit flows to mount `LangflowEditor` instead of `ModernFlowEditor`. Keep the existing `flow_config` JSON shape so saved flows stay compatible (convert nodes/edges → existing `FlowNode[]` on save, and back on load).

### 2. Card Actions & Insights

Enhance `ImprovedAutomationCard.tsx`:

- **Quick actions row** (always visible, not behind expand): Test, Duplicate, Analytics, Edit, Delete dropdown (3-dot menu for Delete + Archive to declutter).
- **Last run pill**: "Last run 2m ago · ✓ success" / "✗ failed" using `automations_logs` (most recent row per automation).
- **Mini sparkline** (last 7 days of triggers) using `recharts` — already in project.
- **Per-step success indicator** in the flow preview: small green/amber/red dot under each step chip based on completion ratio at that step (derived from logs).
- **Duplicate** action: clones the row (new `id`, `name + " (copy)"`, `enabled: false`).

### 3. Performance & Reliability

- **List performance**: paginate/virtualize the automation list (`react-window`) when >20 items; only fetch counts via a single aggregated `select` instead of per-row.
- **Single query for stats**: replace any N+1 fetches in `Automations.tsx` with one `supabase.rpc` or grouped select for triggered/completed/last-run/sparkline data.
- **Optimistic toggle** with rollback on error + toast.
- **Error boundary** around the editor so a bad flow_config doesn't blank the page.
- **Retry-with-backoff helper** in `src/lib/supabaseRetry.ts` wrapping reads that fail with network errors (used by Automations + editor).
- **Skeletons** for cards while loading (replace current spinner).

### Files

```text
add    src/components/automations/LangflowEditor.tsx
add    src/components/automations/langflow/NodePalette.tsx
add    src/components/automations/langflow/nodes/{TriggerNode,DelayNode,ConditionNode,ActionNode}.tsx
add    src/components/automations/langflow/Inspector.tsx
add    src/components/automations/langflow/flowAdapter.ts   (FlowNode[] <-> {nodes,edges})
add    src/components/automations/AutomationCardSkeleton.tsx
add    src/lib/supabaseRetry.ts
edit   src/components/automations/ImprovedAutomationCard.tsx  (quick actions, last-run, sparkline)
edit   src/pages/Automations.tsx                              (single-query stats, pagination, skeletons, duplicate handler)
edit   places that mount ModernFlowEditor                     (swap to LangflowEditor)
deps   bun add @xyflow/react dagre react-window
```

### Out of scope

- No DB schema changes.
- No backend / edge-function changes (flow execution logic untouched).
- Existing `ModernFlowEditor` kept in repo for one release as fallback, then deleted.

Approve and I'll implement in this order: deps → adapter + LangflowEditor skeleton → nodes + palette + inspector → swap-in → card upgrades → perf pass.