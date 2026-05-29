import { useCallback, useRef, useState } from "react";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "./flowAdapter";

export interface FlowSnapshot {
  nodes: CanvasNode[];
  edges: Edge[];
}

const MAX_HISTORY = 100;

const clone = (s: FlowSnapshot): FlowSnapshot => ({
  nodes: s.nodes.map((n) => ({ ...n, position: { ...n.position }, data: { ...n.data, config: { ...(n.data.config ?? {}) } } })),
  edges: s.edges.map((e) => ({ ...e })),
});

export const useFlowHistory = (initial: FlowSnapshot) => {
  const past = useRef<FlowSnapshot[]>([]);
  const future = useRef<FlowSnapshot[]>([]);
  const current = useRef<FlowSnapshot>(clone(initial));
  const [version, setVersion] = useState(0);

  const bump = () => setVersion((v) => v + 1);

  /** Replace baseline without recording history (e.g. controlled state sync). */
  const setBaseline = useCallback((snap: FlowSnapshot) => {
    current.current = clone(snap);
  }, []);

  /** Commit a new snapshot, pushing the previous baseline onto the undo stack. */
  const commit = useCallback((snap: FlowSnapshot) => {
    past.current.push(current.current);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
    current.current = clone(snap);
    bump();
  }, []);

  const undo = useCallback((): FlowSnapshot | null => {
    const prev = past.current.pop();
    if (!prev) return null;
    future.current.push(current.current);
    current.current = prev;
    bump();
    return clone(prev);
  }, []);

  const redo = useCallback((): FlowSnapshot | null => {
    const next = future.current.pop();
    if (!next) return null;
    past.current.push(current.current);
    current.current = next;
    bump();
    return clone(next);
  }, []);

  return {
    commit,
    setBaseline,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    version,
  };
};