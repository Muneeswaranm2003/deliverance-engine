import { useState, useCallback } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Workflow, Zap, ArrowDown } from "lucide-react";
import { FlowStep, NodeConfig } from "./flowTypes";
import { DraggableFlowNode } from "./DraggableFlowNode";
import { BranchingFlowNode } from "./BranchingFlowNode";
import { Button } from "@/components/ui/button";

interface FlowCanvasProps {
  steps: FlowStep[];
  onStepsChange: (steps: FlowStep[]) => void;
  isDraggingFromPalette: boolean;
  draggedNode: NodeConfig | null;
  onConfigureStep?: (step: FlowStep) => void;
}

export const FlowCanvas = ({
  steps,
  onStepsChange,
  isDraggingFromPalette,
  draggedNode,
  onConfigureStep,
}: FlowCanvasProps) => {
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleRemoveStep = useCallback(
    (id: string) => {
      onStepsChange(steps.filter((s) => s.id !== id));
    },
    [steps, onStepsChange]
  );

  const handleUpdateStep = useCallback(
    (id: string, updates: Partial<FlowStep>) => {
      onStepsChange(
        steps.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    [steps, onStepsChange]
  );

  const handleDrop = useCallback(
    (index: number) => {
      if (!draggedNode) return;
      const newStep: FlowStep = {
        id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: draggedNode.category,
        nodeType: draggedNode.id,
        ...(draggedNode.category === "condition"
          ? { yesBranch: [], noBranch: [] }
          : {}),
      };
      const newSteps = [...steps];
      newSteps.splice(index, 0, newStep);
      onStepsChange(newSteps);
      setDropTargetIndex(null);
    },
    [draggedNode, steps, onStepsChange]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (isDraggingFromPalette) {
        setDropTargetIndex(index);
      }
    },
    [isDraggingFromPalette]
  );

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDropOnZone = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      handleDrop(index);
    },
    [handleDrop]
  );

  const handleClearAll = useCallback(() => {
    onStepsChange([]);
  }, [onStepsChange]);

  return (
    <div className="flex-1 min-h-0 overflow-auto relative">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 p-6">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Workflow className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Flow Canvas</h3>
                <p className="text-[10px] text-muted-foreground">
                  {steps.length === 0
                    ? "Start building your automation"
                    : `${steps.length} step${steps.length !== 1 ? "s" : ""} in flow`}
                </p>
              </div>
            </div>
            {steps.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive text-xs h-8"
                onClick={handleClearAll}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          {/* Empty state */}
          {steps.length === 0 && !isDraggingFromPalette && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-2 border-dashed border-border/50 rounded-2xl p-10 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-primary/40" />
              </div>
              <h4 className="text-sm font-semibold mb-1">
                Build Your Automation
              </h4>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                Drag a trigger from the components panel to get started, then add
                actions, delays, and conditions.
              </p>
              <div className="flex items-center justify-center gap-4 mt-5">
                {["Trigger", "Delay", "Action"].map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <ArrowDown className="w-3 h-3 text-muted-foreground/30 -rotate-90" />
                    )}
                    <span className="text-[10px] px-2 py-1 rounded-md bg-secondary/60 text-muted-foreground font-medium">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Drop zone at top (when dragging or empty) */}
          {(steps.length === 0 && isDraggingFromPalette) ||
          (steps.length > 0 && isDraggingFromPalette) ? (
            <div
              onDragOver={(e) => handleDragOver(e, 0)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropOnZone(e, 0)}
              className={cn(
                "border-2 border-dashed rounded-xl p-6 mb-4 text-center transition-all duration-200",
                dropTargetIndex === 0
                  ? "border-primary bg-primary/5 scale-[1.01] shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
                  : "border-border/40 bg-secondary/10",
                steps.length === 0 && "min-h-[160px] flex flex-col items-center justify-center"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-colors",
                  dropTargetIndex === 0
                    ? "bg-primary/10"
                    : "bg-secondary/40"
                )}
              >
                <Plus
                  className={cn(
                    "w-5 h-5",
                    dropTargetIndex === 0
                      ? "text-primary"
                      : "text-muted-foreground/50"
                  )}
                />
              </div>
              <p
                className={cn(
                  "text-xs font-medium",
                  dropTargetIndex === 0
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {steps.length === 0
                  ? "Drop your first node here"
                  : "Drop here to add at start"}
              </p>
            </motion.div>
          ) : null}

          {/* Flow Steps */}
          <AnimatePresence mode="popLayout">
            <Reorder.Group
              axis="y"
              values={steps}
              onReorder={onStepsChange}
              className="space-y-0"
            >
              {steps.map((step, index) => (
                <div key={step.id}>
                  {step.type === "condition" ? (
                    <Reorder.Item
                      value={step}
                      dragListener={false}
                      className="relative"
                    >
                      <BranchingFlowNode
                        step={step}
                        index={index}
                        isFirst={index === 0}
                        isLast={index === steps.length - 1}
                        onRemove={handleRemoveStep}
                        onUpdateStep={handleUpdateStep}
                        isDraggingFromPalette={isDraggingFromPalette}
                        draggedNode={draggedNode}
                        onConfigureStep={onConfigureStep}
                      />
                    </Reorder.Item>
                  ) : (
                    <DraggableFlowNode
                      step={step}
                      index={index}
                      isFirst={index === 0}
                      isLast={index === steps.length - 1}
                      onRemove={handleRemoveStep}
                      onConfigure={onConfigureStep}
                    />
                  )}

                  {/* Drop zone after each step */}
                  {isDraggingFromPalette && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      onDragOver={(e) => handleDragOver(e, index + 1)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropOnZone(e, index + 1)}
                      className={cn(
                        "border-2 border-dashed rounded-xl py-3 my-2 text-center transition-all duration-200",
                        dropTargetIndex === index + 1
                          ? "border-primary bg-primary/5 shadow-[0_0_15px_hsl(var(--primary)/0.08)]"
                          : "border-border/20"
                      )}
                    >
                      <Plus
                        className={cn(
                          "w-4 h-4 mx-auto",
                          dropTargetIndex === index + 1
                            ? "text-primary"
                            : "text-muted-foreground/30"
                        )}
                      />
                    </motion.div>
                  )}
                </div>
              ))}
            </Reorder.Group>
          </AnimatePresence>

          {/* End of flow indicator */}
          {steps.length > 0 && !isDraggingFromPalette && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center pt-2"
            >
              <div className="w-0.5 h-5 bg-gradient-to-b from-border to-transparent" />
              <div className="mt-2 px-3 py-1.5 rounded-full bg-secondary/40 border border-border/30">
                <p className="text-[10px] text-muted-foreground font-medium">
                  End of flow • Drag more from components
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
