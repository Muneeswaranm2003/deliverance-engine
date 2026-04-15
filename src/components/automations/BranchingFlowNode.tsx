import { useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X, Plus, GitBranch, Check, XIcon, Settings } from "lucide-react";
import { FlowStep, NodeConfig, nodeStyles } from "./flowTypes";
import { nodeCategories } from "./NodePalette";
import { Button } from "@/components/ui/button";

interface BranchingFlowNodeProps {
  step: FlowStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onRemove: (id: string) => void;
  onUpdateStep: (id: string, updates: Partial<FlowStep>) => void;
  isDraggingFromPalette: boolean;
  draggedNode: NodeConfig | null;
  onConfigureStep?: (step: FlowStep) => void;
}

export const BranchingFlowNode = ({
  step,
  index,
  isFirst,
  isLast,
  onRemove,
  onUpdateStep,
  isDraggingFromPalette,
  draggedNode,
  onConfigureStep,
}: BranchingFlowNodeProps) => {
  const styles = nodeStyles.condition;

  const nodeConfig = useMemo(() => {
    for (const cat of nodeCategories) {
      const found = cat.nodes.find((n) => n.id === step.nodeType);
      if (found) return found;
    }
    return null;
  }, [step.nodeType]);

  const Icon = nodeConfig?.icon || GitBranch;
  const yesBranch = step.yesBranch || [];
  const noBranch = step.noBranch || [];

  const handleAddToBranch = useCallback(
    (branch: "yes" | "no", node: NodeConfig) => {
      const newStep: FlowStep = {
        id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: node.category,
        nodeType: node.id,
      };
      if (branch === "yes") {
        onUpdateStep(step.id, { yesBranch: [...yesBranch, newStep] });
      } else {
        onUpdateStep(step.id, { noBranch: [...noBranch, newStep] });
      }
    },
    [step.id, yesBranch, noBranch, onUpdateStep]
  );

  const handleDropOnBranch = useCallback(
    (e: React.DragEvent, branch: "yes" | "no") => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedNode) return;
      handleAddToBranch(branch, draggedNode);
    },
    [draggedNode, handleAddToBranch]
  );

  const handleRemoveFromBranch = useCallback(
    (branch: "yes" | "no", id: string) => {
      if (branch === "yes") {
        onUpdateStep(step.id, {
          yesBranch: yesBranch.filter((s) => s.id !== id),
        });
      } else {
        onUpdateStep(step.id, {
          noBranch: noBranch.filter((s) => s.id !== id),
        });
      }
    },
    [step.id, yesBranch, noBranch, onUpdateStep]
  );

  const isConfigured = step.config && Object.keys(step.config).length > 0;

  return (
    <div className="relative">
      {/* Connector from previous node */}
      {!isFirst && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 flex flex-col items-center">
          <div className="w-0.5 h-full bg-gradient-to-b from-border to-violet-500/40" />
        </div>
      )}

      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          "relative rounded-2xl border backdrop-blur-sm overflow-hidden",
          styles.bg,
          styles.border,
          styles.glow
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="relative w-10 h-10 shrink-0">
            <div
              className={cn(
                "absolute inset-0.5 rotate-45 rounded-lg",
                styles.iconBg
              )}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon className={cn("w-5 h-5", styles.iconColor)} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">
              {nodeConfig?.name || step.nodeType}
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span
                className={cn(
                  "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                  isConfigured ? "bg-emerald-500" : "bg-amber-500/60"
                )}
              />
              {isConfigured ? "Condition configured" : "Click to configure condition"}
            </p>
          </div>

          <div className="flex items-center gap-0.5">
            {onConfigureStep && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onConfigureStep(step)}
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(step.id)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Branch paths */}
        <div className="grid grid-cols-2 gap-0 border-t border-violet-500/15">
          <BranchColumn
            label="Yes"
            labelIcon={<Check className="w-3 h-3" />}
            labelColor="text-emerald-500"
            borderColor="border-emerald-500/20"
            bgColor="bg-emerald-500/[0.03]"
            accentColor="border-emerald-500/40"
            steps={yesBranch}
            onRemoveStep={(id) => handleRemoveFromBranch("yes", id)}
            onDrop={(e) => handleDropOnBranch(e, "yes")}
            isDraggingFromPalette={isDraggingFromPalette}
          />
          <BranchColumn
            label="No"
            labelIcon={<XIcon className="w-3 h-3" />}
            labelColor="text-red-400"
            borderColor="border-red-400/20"
            bgColor="bg-red-400/[0.03]"
            accentColor="border-red-400/40"
            steps={noBranch}
            onRemoveStep={(id) => handleRemoveFromBranch("no", id)}
            onDrop={(e) => handleDropOnBranch(e, "no")}
            isDraggingFromPalette={isDraggingFromPalette}
          />
        </div>
      </motion.div>

      {/* Connector to next node */}
      {!isLast && (
        <div className="flex flex-col items-center py-0.5">
          <div className="w-0.5 h-4 bg-gradient-to-b from-violet-500/40 to-border" />
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-violet-500/40" />
        </div>
      )}
    </div>
  );
};

/** A single branch column (Yes or No) */
interface BranchColumnProps {
  label: string;
  labelIcon: React.ReactNode;
  labelColor: string;
  borderColor: string;
  bgColor: string;
  accentColor: string;
  steps: FlowStep[];
  onRemoveStep: (id: string) => void;
  onDrop: (e: React.DragEvent) => void;
  isDraggingFromPalette: boolean;
}

const BranchColumn = ({
  label,
  labelIcon,
  labelColor,
  borderColor,
  bgColor,
  accentColor,
  steps,
  onRemoveStep,
  onDrop,
  isDraggingFromPalette,
}: BranchColumnProps) => {
  return (
    <div
      className={cn(
        "p-3 min-h-[90px]",
        bgColor,
        "first:border-r",
        borderColor
      )}
    >
      {/* Branch label */}
      <div
        className={cn(
          "inline-flex items-center gap-1.5 mb-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
          labelColor,
          label === "Yes" ? "bg-emerald-500/10" : "bg-red-400/10"
        )}
      >
        {labelIcon}
        {label} Path
      </div>

      {/* Branch steps */}
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {steps.map((branchStep) => (
            <BranchStepNode
              key={branchStep.id}
              step={branchStep}
              onRemove={onRemoveStep}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
        className={cn(
          "mt-2 border-2 border-dashed rounded-lg py-2.5 text-center transition-all",
          isDraggingFromPalette
            ? cn(accentColor, bgColor, "opacity-100")
            : "border-border/20 opacity-50"
        )}
      >
        <Plus
          className={cn(
            "w-3.5 h-3.5 mx-auto",
            isDraggingFromPalette ? labelColor : "text-muted-foreground/30"
          )}
        />
        <p className="text-[9px] text-muted-foreground mt-0.5">
          {isDraggingFromPalette ? "Drop here" : "Drag node"}
        </p>
      </div>
    </div>
  );
};

/** A compact node rendered inside a branch */
const BranchStepNode = ({
  step,
  onRemove,
}: {
  step: FlowStep;
  onRemove: (id: string) => void;
}) => {
  const styles = nodeStyles[step.type];

  const nodeConfig = useMemo(() => {
    for (const cat of nodeCategories) {
      const found = cat.nodes.find((n) => n.id === step.nodeType);
      if (found) return found;
    }
    return null;
  }, [step.nodeType]);

  const Icon = nodeConfig?.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group flex items-center gap-2 px-2.5 py-2 rounded-lg border backdrop-blur-sm transition-shadow",
        styles.bg,
        styles.border,
        "hover:shadow-sm"
      )}
    >
      {Icon && (
        <div
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
            styles.iconBg
          )}
        >
          <Icon className={cn("w-3 h-3", styles.iconColor)} />
        </div>
      )}
      <span className="text-[11px] font-medium truncate flex-1">
        {nodeConfig?.name || step.nodeType}
      </span>
      <button
        onClick={() => onRemove(step.id)}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
};
