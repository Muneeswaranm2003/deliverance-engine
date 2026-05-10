import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_REGISTRY, kindStyle, type NodeKind } from "./nodeRegistry";

interface NodePaletteProps {
  onDragStart?: (kind: NodeKind, type: string) => void;
}

const ORDER: NodeKind[] = ["trigger", "delay", "condition", "action"];

export const NodePalette = ({ onDragStart }: NodePaletteProps) => {
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const filtered = NODE_REGISTRY.filter((n) =>
      [n.label, n.type, n.description].some((s) => s.toLowerCase().includes(q.toLowerCase()))
    );
    return ORDER.map((k) => ({ kind: k, items: filtered.filter((n) => n.kind === k) }));
  }, [q]);

  return (
    <aside className="w-64 shrink-0 border-r border-border/60 bg-background/40 backdrop-blur flex flex-col h-full">
      <div className="p-3 border-b border-border/60">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search nodes…"
            className="pl-8 h-8 text-xs bg-card/60"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {grouped.map(({ kind, items }) => {
          if (items.length === 0) return null;
          const s = kindStyle[kind];
          return (
            <div key={kind}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  {s.label}s
                </span>
              </div>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={`${item.kind}-${item.type}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/automation-node",
                          JSON.stringify({ kind: item.kind, type: item.type })
                        );
                        e.dataTransfer.effectAllowed = "move";
                        onDragStart?.(item.kind, item.type);
                      }}
                      className={cn(
                        "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing",
                        "bg-card/40 hover:bg-card/80 transition-all hover:scale-[1.02] hover:shadow-md",
                        s.border
                      )}
                      title={item.description}
                    >
                      <div className={cn("p-1.5 rounded-md", s.bg)}>
                        <Icon className={cn("w-3.5 h-3.5", s.icon)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {item.description}
                        </p>
                      </div>
                      <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
