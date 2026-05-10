import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Zap, Wand2, Save, X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import type { FlowNode } from "./ModernFlowEditor";
import { AutomationNode } from "./langflow/AutomationNode";
import { NodePalette } from "./langflow/NodePalette";
import { Inspector } from "./langflow/Inspector";
import {
  autoLayout,
  canvasToFlow,
  flowToCanvas,
  type CanvasNode,
} from "./langflow/flowAdapter";
import { findNodeDef, type NodeKind } from "./langflow/nodeRegistry";

interface LangflowEditorProps {
  onSubmit: (data: { name: string; description: string; steps: FlowNode[] }) => void;
  onCancel: () => void;
  isSaving: boolean;
  initialData?: { name: string; description: string; steps: FlowNode[] };
}

const nodeTypes: NodeTypes = { automation: AutomationNode };

const InnerEditor = ({ onSubmit, onCancel, isSaving, initialData }: LangflowEditorProps) => {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const initial = useMemo(
    () => flowToCanvas(initialData?.steps ?? []),
    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [nodes, setNodes] = useState<CanvasNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Initial fit
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.25, duration: 250 }), 50);
    return () => clearTimeout(t);
  }, [fitView]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as CanvasNode[]),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            label: params.sourceHandle === "yes" ? "Yes" : params.sourceHandle === "no" ? "No" : undefined,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          },
          eds
        )
      ),
    []
  );

  const addNodeAt = useCallback(
    (kind: NodeKind, type: string, clientX: number, clientY: number) => {
      const def = findNodeDef(kind, type);
      if (!def) return;
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newNode: CanvasNode = {
        id,
        type: "automation",
        position,
        data: {
          kind,
          nodeType: type,
          label: def.label,
          config: { ...(def.defaultConfig ?? {}) },
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedId(id);
    },
    [screenToFlowPosition]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/automation-node");
      if (!raw) return;
      try {
        const { kind, type } = JSON.parse(raw);
        addNodeAt(kind, type, event.clientX, event.clientY);
      } catch {
        /* ignore */
      }
    },
    [addNodeAt]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleAutoLayout = useCallback(() => {
    const laid = autoLayout(nodes, edges);
    setNodes(laid.nodes);
    setEdges(laid.edges);
    setTimeout(() => fitView({ padding: 0.25, duration: 250 }), 50);
  }, [nodes, edges, fitView]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const handleNodeChange = useCallback(
    (id: string, patch: Partial<CanvasNode["data"]>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
      );
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        handleDeleteNode(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, handleDeleteNode]);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const steps = useMemo(() => canvasToFlow(nodes, edges), [nodes, edges]);
  const hasTrigger = nodes.some((n) => n.data.kind === "trigger");
  const hasAction = nodes.some((n) => n.data.kind === "action");
  const isValid = name.trim().length > 0 && hasTrigger && hasAction;

  const handleSave = () => {
    if (!isValid) return;
    onSubmit({ name, description, steps });
  };

  return (
    <div className="flex flex-col h-[85vh] bg-background overflow-hidden">
      {/* Top bar */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-3 bg-card/40 backdrop-blur">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">
            {initialData ? "Edit flow" : "New flow"}
          </span>
        </div>
        <div className="h-5 w-px bg-border/60" />
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Automation name"
            className="h-8 text-sm bg-card/60"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="h-8 text-sm bg-card/60 hidden md:block"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleAutoLayout}>
            <Wand2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Auto-layout</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={onCancel}>
            <X className="w-3.5 h-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleSave}
            disabled={!isValid || isSaving}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Validation strip */}
      {(!hasTrigger || !hasAction) && nodes.length > 0 && (
        <div className="px-4 py-1.5 text-[11px] bg-amber-500/10 border-b border-amber-500/20 text-amber-300 flex items-center gap-2">
          <Zap className="w-3 h-3" />
          {!hasTrigger && "Add a trigger node to start the flow."}{" "}
          {!hasAction && "Add an action node so the flow does something."}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <NodePalette />

        <div ref={wrapperRef} className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
          {nodes.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
              <div className="text-center max-w-xs">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 mx-auto flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-semibold">Drag a node to start</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pick a trigger from the left, then drop actions and delays to chain them.
                </p>
              </div>
            </motion.div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { stroke: "hsl(var(--border))", strokeWidth: 2 },
            }}
            className="bg-background"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              color="hsl(var(--border))"
            />
            <Controls
              className="!bg-card/80 !border !border-border/60 !rounded-lg !shadow-lg [&>button]:!bg-transparent [&>button]:!border-border/60 [&>button]:!text-foreground"
              showInteractive={false}
            />
            <MiniMap
              pannable
              zoomable
              className="!bg-card/80 !border !border-border/60 !rounded-lg overflow-hidden"
              nodeColor={(n) => {
                const k = (n.data as CanvasNode["data"])?.kind;
                if (k === "trigger") return "hsl(217 91% 60%)";
                if (k === "delay") return "hsl(38 92% 50%)";
                if (k === "condition") return "hsl(270 70% 60%)";
                return "hsl(142 71% 45%)";
              }}
              maskColor="hsl(var(--background) / 0.7)"
            />
          </ReactFlow>
        </div>

        <Inspector
          node={selectedNode}
          onChange={handleNodeChange}
          onDelete={handleDeleteNode}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
};

export const LangflowEditor = (props: LangflowEditorProps) => (
  <ReactFlowProvider>
    <InnerEditor {...props} />
  </ReactFlowProvider>
);

// Re-export the FlowNode type for convenience
export type { FlowNode };
