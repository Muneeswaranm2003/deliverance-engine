import { useMemo } from "react";
import { motion, Reorder, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { GripVertical, X, Settings, ChevronRight } from "lucide-react";
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
      return "Configured ✓";
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
  const dragControls = useDragControls();
  const styles = nodeStyles[step.type];

  const nodeConfig = useMemo(() => {
    for (const cat of nodeCategories) {
      const found = cat.nodes.find((n) => n.id === step.nodeType);
      if (found) return found;
    }
    return null;
  }, [step.nodeType]);

  const Icon = nodeConfig?.icon;
  const isConfigured = step.config && Object.keys(step.config).length > 0;

  return (
    <div className="relative">
      {/* Connector line from previous node */}
      {!isFirst && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 flex flex-col items-center">
          <div className="w-0.5 h-full bg-gradient-to-b from-border to-primary/30" />
        </div>
      )}

      <Reorder.Item
        value={step}
        dragListener={false}
        dragControls={dragControls}
        className="relative"
      >
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "group relative flex items-center gap-3 px-4 py-3.5 rounded-xl border backdrop-blur-sm",
            "transition-shadow duration-200",
            styles.bg,
            styles.border,
            "hover:shadow-md"
          )}
        >
          {/* Drag Handle */}
          <button
            className="cursor-grab active:cursor-grabbing touch-none opacity-40 group-hover:opacity-100 transition-opacity"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Step Number */}
          <div
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
              styles.iconBg,
              styles.iconColor
            )}
          >
            {index + 1}
          </div>

          {/* Icon */}
          {Icon && (
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                styles.iconBg
              )}
            >
              <Icon className={cn("w-5 h-5", styles.iconColor)} />
            </div>
          )}

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">
              {nodeConfig?.name || step.nodeType}
            </p>
            {isConfigured ? (
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                {getConfigSummary(step)}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/60 shrink-0" />
                {onConfigure ? "Click to configure" : step.type}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onConfigure && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onConfigure(step)}
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            )}
            {!isFirst && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(step.id)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Configure hint arrow */}
          {onConfigure && !isConfigured && (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 group-hover:hidden" />
          )}
        </motion.div>
      </Reorder.Item>

      {/* Connector line to next node */}
      {!isLast && (
        <div className="flex flex-col items-center py-0.5">
          <div className="w-0.5 h-4 bg-gradient-to-b from-primary/30 to-border" />
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-primary/40" />
        </div>
      )}
    </div>
  );
};
