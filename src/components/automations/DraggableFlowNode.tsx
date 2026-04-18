import { useMemo } from "react";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical, X, Settings, Play } from "lucide-react";
import { FlowStep, nodeStyles } from "./flowTypes";
import { nodeCategories } from "./NodePalette";
import { Button } from "@/components/ui/button";

/** Get a short summary of the node's configuration */
function getConfigSummary(step: FlowStep): string {
  const c = step.config || {};
  switch (step.nodeType) {
    case "send_email":
    case "send_reengagement":
      return (c.template_name as string) || (c.subject as string) || "Configured";
    case "add_tag":
      return c.tag_name ? `Tag: ${c.tag_name}` : "Configured";
    case "move_list":
      return c.list_name ? `List: ${c.list_name}` : "Configured";
    case "webhook":
      return (c.webhook_url as string) || "Configured";
    case "wait_custom":
      return c.delay_value ? `${c.delay_value} ${c.delay_unit || "hours"}` : "Configured";
    case "notify":
      return c.channel ? `Via ${c.channel}` : "Configured";
    default:
      return "Configured";
  }
}

interface DraggableFlowNodeProps {
  step: FlowStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onRemove: (id: string) => void;
  onConfigure?: (step: FlowStep) => void;
}

export const DraggableFlowNode = ({
  step,
  index,
  isFirst,
  isLast,
  onRemove,
  onConfigure,
}: DraggableFlowNodeProps) => {
  const styles = nodeStyles[step.type];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, data: { source: "canvas", stepId: step.id } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const nodeConfig = useMemo(() => {
    for (const cat of nodeCategories) {
      const found = cat.nodes.find((n) => n.id === step.nodeType);
      if (found) return found;
    }
    return null;
  }, [step.nodeType]);

  const Icon = nodeConfig?.icon;
  const isConfigured = step.config && Object.keys(step.config).length > 0;

  // Accent color per category for handles
  const accentClass = {
    trigger: "bg-emerald-500",
    delay: "bg-amber-500",
    action: "bg-primary",
    condition: "bg-violet-500",
  }[step.type];

  const accentRing = {
    trigger: "ring-emerald-500/30",
    delay: "ring-amber-500/30",
    action: "ring-primary/30",
    condition: "ring-violet-500/30",
  }[step.type];

  return (
    <div className="relative" ref={setNodeRef} style={style}>
      {/* Connector line from previous node */}
      {!isFirst && (
        <div className="flex justify-center">
          <svg width="2" height="32" className="overflow-visible">
            <line
              x1="1"
              y1="0"
              x2="1"
              y2="32"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          </svg>
        </div>
      )}

      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "group relative rounded-xl border backdrop-blur-md overflow-hidden",
          "bg-[hsl(var(--card))]/95 border-border/60",
          "transition-all duration-200",
          "hover:border-border hover:shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.25)]",
          "shadow-[0_2px_10px_-2px_rgba(0,0,0,0.3)]",
          isDragging && "opacity-50 z-50"
        )}
        data-testid={`flow-step-${step.id}`}
      >
        {/* Input handle (left) */}
        {!isFirst && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10">
            <div className={cn("w-3 h-3 rounded-full ring-4 ring-background", accentClass, accentRing)} />
          </div>
        )}
        {/* Output handle (right) */}
        {!isLast && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
            <div className={cn("w-3 h-3 rounded-full ring-4 ring-background", accentClass, accentRing)} />
          </div>
        )}

        {/* Header bar */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 border-b border-border/40",
            styles.bg
          )}
        >
          {/* Drag handle */}
          <button
            ref={undefined}
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none opacity-40 group-hover:opacity-100 transition-opacity"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {/* Icon */}
          {Icon && (
            <div
              className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                styles.iconBg
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", styles.iconColor)} />
            </div>
          )}

          {/* Title */}
          <p className="text-[12px] font-semibold flex-1 truncate text-foreground/90">
            {nodeConfig?.name || step.nodeType}
          </p>

          {/* Step badge */}
          <span
            className={cn(
              "text-[9px] font-mono px-1.5 py-0.5 rounded bg-background/60 border border-border/40",
              styles.iconColor
            )}
          >
            {String(index + 1).padStart(2, "0")}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onConfigure && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onConfigure(step)}
              >
                <Settings className="w-3 h-3" />
              </Button>
            )}
            {!isFirst && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(step.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-2">
          {nodeConfig?.description && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {nodeConfig.description}
            </p>
          )}

          <button
            onClick={() => onConfigure?.(step)}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md",
              "bg-background/60 border border-border/40 hover:border-primary/40 transition-colors",
              "text-left"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  isConfigured ? "bg-emerald-500" : "bg-amber-500/70"
                )}
              />
              <span className="text-[11px] truncate text-foreground/80">
                {isConfigured ? getConfigSummary(step) : "Click to configure"}
              </span>
            </div>
            <Settings className="w-3 h-3 text-muted-foreground/60 shrink-0" />
          </button>

          {!isLast && (
            <div className="flex items-center justify-end gap-1.5 pt-0.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                Output
              </span>
              <Play className={cn("w-2.5 h-2.5 fill-current", styles.iconColor)} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
