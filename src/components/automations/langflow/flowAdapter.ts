import type { Node, Edge } from "@xyflow/react";
import dagre from "dagre";
import type { FlowNode } from "../ModernFlowEditor";
import { NODE_REGISTRY, findNodeDef, type NodeKind } from "./nodeRegistry";

export interface CanvasNodeData extends Record<string, unknown> {
  kind: NodeKind;
  nodeType: string;
  label: string;
  config: Record<string, unknown>;
}

export type CanvasNode = Node<CanvasNodeData>;

const NODE_WIDTH = 240;
const NODE_HEIGHT = 96;

/**
 * Convert flat FlowNode[] (the storage format) into ReactFlow nodes + edges.
 * Conditions branch into yesBranch / noBranch.
 */
export function flowToCanvas(steps: FlowNode[]): { nodes: CanvasNode[]; edges: Edge[] } {
  const nodes: CanvasNode[] = [];
  const edges: Edge[] = [];

  const visit = (list: FlowNode[], parentId: string | null, branchLabel?: string) => {
    let prevId = parentId;
    let prevLabel = branchLabel;
    for (const step of list) {
      const def = findNodeDef(step.type as NodeKind, step.nodeType);
      const id = step.id || `n-${Math.random().toString(36).slice(2, 9)}`;
      nodes.push({
        id,
        type: "automation",
        position: { x: 0, y: 0 },
        data: {
          kind: step.type as NodeKind,
          nodeType: step.nodeType,
          label: def?.label ?? step.nodeType,
          config: step.config ?? {},
        },
      });
      if (prevId) {
        edges.push({
          id: `e-${prevId}-${id}`,
          source: prevId,
          target: id,
          type: "smoothstep",
          animated: false,
          label: prevLabel,
          style: { stroke: "hsl(var(--border))", strokeWidth: 2 },
        });
      }
      prevId = id;
      prevLabel = undefined;

      if (step.type === "condition") {
        if (step.yesBranch?.length) visit(step.yesBranch, id, "Yes");
        if (step.noBranch?.length) visit(step.noBranch, id, "No");
        prevId = null; // condition splits the flow
      }
    }
  };

  visit(steps, null);
  return autoLayout(nodes, edges);
}

/**
 * Convert ReactFlow nodes + edges back into the flat FlowNode[] storage format.
 * Walks the graph from the trigger root, following edges in source-position order.
 */
export function canvasToFlow(nodes: CanvasNode[], edges: Edge[]): FlowNode[] {
  if (nodes.length === 0) return [];

  const childrenOf = (id: string): { id: string; label?: string }[] =>
    edges
      .filter((e) => e.source === id)
      .map((e) => ({ id: e.target, label: typeof e.label === "string" ? e.label : undefined }));

  const inDegree = new Map<string, number>();
  nodes.forEach((n) => inDegree.set(n.id, 0));
  edges.forEach((e) => inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1));

  const roots = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  // Prefer trigger as root if multiple
  const start = roots.find((n) => n.data.kind === "trigger") ?? roots[0];
  if (!start) return [];

  const visited = new Set<string>();

  const buildLinear = (rootId: string, stopAtBranch = true): FlowNode[] => {
    const result: FlowNode[] = [];
    let current: string | undefined = rootId;
    while (current && !visited.has(current)) {
      visited.add(current);
      const node = nodes.find((n) => n.id === current);
      if (!node) break;
      const step: FlowNode = {
        id: node.id,
        type: node.data.kind,
        nodeType: node.data.nodeType,
        config: node.data.config,
      };
      if (node.data.kind === "condition") {
        const kids = childrenOf(node.id);
        const yesEdge = kids.find((k) => (k.label ?? "").toLowerCase() === "yes") ?? kids[0];
        const noEdge = kids.find((k) => (k.label ?? "").toLowerCase() === "no") ?? kids[1];
        if (yesEdge) step.yesBranch = buildLinear(yesEdge.id, false);
        if (noEdge) step.noBranch = buildLinear(noEdge.id, false);
        result.push(step);
        return result;
      }
      result.push(step);
      const kids = childrenOf(current);
      current = kids[0]?.id;
    }
    return result;
  };

  return buildLinear(start.id);
}

/** Run dagre auto-layout on nodes/edges and return them with new positions. */
export function autoLayout(
  nodes: CanvasNode[],
  edges: Edge[],
  direction: "LR" | "TB" = "LR"
): { nodes: CanvasNode[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 90 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const positioned = nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 },
    } as CanvasNode;
  });
  return { nodes: positioned, edges };
}

export { NODE_REGISTRY };
