import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { findNodeDef, kindStyle } from "./nodeRegistry";
import type { CanvasNodeData } from "./flowAdapter";

function AutomationNodeComponent({ data, selected }: NodeProps) {
  const d = data as CanvasNodeData;
  const def = findNodeDef(d.kind, d.nodeType);
  const Icon = def?.icon;
  const style = kindStyle[d.kind];
  const isCondition = d.kind === "condition";

  return (
    <div
      className={cn(
        "group relative w-[240px] rounded-xl border backdrop-blur transition-all",
        "bg-card/80 shadow-lg",
        style.border,
        selected && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background scale-[1.02]"
      )}
    >
      {/* Input handle (not for triggers) */}
      {d.kind !== "trigger" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-background !border-2 !border-primary"
        />
      )}

      {/* Top accent bar */}
      <div className={cn("h-1 w-full rounded-t-xl", style.dot)} />

      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("p-2 rounded-lg ring-1", style.bg, style.ring)}>
            {Icon && <Icon className={cn("w-4 h-4", style.icon)} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                {style.label}
              </span>
              <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
            </div>
            <p className="text-sm font-semibold truncate text-foreground">
              {d.label}
            </p>
          </div>
        </div>
        {def?.description && (
          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">
            {def.description}
          </p>
        )}
      </div>

      {/* Output handle(s) */}
      {isCondition ? (
        <>
          <Handle
            id="yes"
            type="source"
            position={Position.Right}
            style={{ top: "35%" }}
            className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-background"
          />
          <Handle
            id="no"
            type="source"
            position={Position.Right}
            style={{ top: "70%" }}
            className="!w-3 !h-3 !bg-rose-400 !border-2 !border-background"
          />
          <span className="absolute right-1 top-[28%] text-[9px] font-bold text-emerald-400">YES</span>
          <span className="absolute right-1 top-[63%] text-[9px] font-bold text-rose-400">NO</span>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-background !border-2 !border-primary"
        />
      )}
    </div>
  );
}

export const AutomationNode = memo(AutomationNodeComponent);
