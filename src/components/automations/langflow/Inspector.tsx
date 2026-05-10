import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { findNodeDef, kindStyle } from "./nodeRegistry";
import type { CanvasNode } from "./flowAdapter";

interface InspectorProps {
  node: CanvasNode | null;
  onChange: (id: string, patch: Partial<CanvasNode["data"]>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const Inspector = ({ node, onChange, onDelete, onClose }: InspectorProps) => {
  if (!node) {
    return (
      <aside className="w-80 shrink-0 border-l border-border/60 bg-background/40 backdrop-blur p-6 hidden lg:flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center mb-3">
          <X className="w-5 h-5 text-muted-foreground opacity-50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No node selected</p>
        <p className="text-xs text-muted-foreground mt-1">
          Click a node on the canvas to configure it.
        </p>
      </aside>
    );
  }

  const def = findNodeDef(node.data.kind, node.data.nodeType);
  const style = kindStyle[node.data.kind];
  const Icon = def?.icon;
  const config = node.data.config ?? {};

  const updateConfig = (key: string, value: unknown) => {
    onChange(node.id, { config: { ...config, [key]: value } });
  };

  return (
    <aside className="w-80 shrink-0 border-l border-border/60 bg-background/40 backdrop-blur flex flex-col h-full">
      <div className="p-4 border-b border-border/60 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("p-2 rounded-lg ring-1", style.bg, style.ring)}>
            {Icon && <Icon className={cn("w-4 h-4", style.icon)} />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {style.label}
            </p>
            <p className="text-sm font-semibold truncate">{node.data.label}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Display name</Label>
          <Input
            value={node.data.label}
            onChange={(e) => onChange(node.id, { label: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        {/* Action-specific */}
        {node.data.kind === "action" && node.data.nodeType === "send_email" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                value={(config.subject as string) ?? ""}
                onChange={(e) => updateConfig("subject", e.target.value)}
                placeholder="e.g. We miss you, {{first_name}}"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body</Label>
              <Textarea
                value={(config.body as string) ?? ""}
                onChange={(e) => updateConfig("body", e.target.value)}
                placeholder="Email body…"
                className="min-h-[120px] text-sm"
              />
            </div>
          </>
        )}

        {node.data.kind === "action" && node.data.nodeType === "add_tag" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Tag</Label>
            <Input
              value={(config.tag as string) ?? ""}
              onChange={(e) => updateConfig("tag", e.target.value)}
              placeholder="e.g. vip"
              className="h-8 text-sm"
            />
          </div>
        )}

        {node.data.kind === "action" && node.data.nodeType === "webhook" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Webhook URL</Label>
            <Input
              value={(config.url as string) ?? ""}
              onChange={(e) => updateConfig("url", e.target.value)}
              placeholder="https://…"
              className="h-8 text-sm"
            />
          </div>
        )}

        {node.data.kind === "delay" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Duration</Label>
            <Input
              value={(config.duration as string) ?? node.data.nodeType}
              onChange={(e) => updateConfig("duration", e.target.value)}
              placeholder="e.g. 1d, 6h, 2w"
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Format: number + unit (h, d, w)
            </p>
          </div>
        )}

        {node.data.kind === "condition" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Condition label</Label>
            <Input
              value={(config.label as string) ?? node.data.label}
              onChange={(e) => updateConfig("label", e.target.value)}
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Connect Yes / No outputs to different branches.
            </p>
          </div>
        )}

        {def?.description && (
          <div className="rounded-md bg-muted/30 p-3 text-[11px] text-muted-foreground">
            {def.description}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border/60">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-destructive hover:text-destructive"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove node
        </Button>
      </div>
    </aside>
  );
};
