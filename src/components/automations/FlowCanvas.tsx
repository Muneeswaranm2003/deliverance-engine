import { useState, useCallback } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { FlowStep, NodeConfig } from "./flowTypes";
import { DraggableFlowNode } from "./DraggableFlowNode";
import { BranchingFlowNode } from "./BranchingFlowNode";
import { Button } from "@/components/ui/button";

interface FlowCanvasProps {
  steps: FlowStep[];
  onStepsChange: (steps: FlowStep[]) => void;
  isDraggingFromPalette: boolean;
  draggedNode: NodeConfig | null;
}

export const FlowCanvas = ({
  steps,
  onStepsChange,
  isDraggingFromPalette,
  draggedNode,
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
    <div className="flex-1 min-h-0 overflow-auto p-6 bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold">Flow Canvas</h3>
            <p className="text-xs text-muted-foreground">
              Drag nodes from the palette or reorder existing steps
            </p>
          </div>
          {steps.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleClearAll}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Drop zone at top */}
        {steps.length === 0 || isDraggingFromPalette ? (
          <div
            onDragOver={(e) => handleDragOver(e, 0)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDropOnZone(e, 0)}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 mb-4 text-center transition-all",
              dropTargetIndex === 0
                ? "border-primary bg-primary/10 scale-[1.02]"
                : "border-border/50 bg-secondary/20",
              steps.length === 0 && "min-h-[200px] flex flex-col items-center justify-center"
            )}
          >
            <Plus className={cn(
              "w-8 h-8 mx-auto mb-2",
              dropTargetIndex === 0 ? "text-primary" : "text-muted-foreground"
            )} />
            <p className={cn(
              "text-sm font-medium",
              dropTargetIndex === 0 ? "text-primary" : "text-muted-foreground"
            )}>
              {steps.length === 0 ? "Drop your first node here" : "Drop here to add at start"}
            </p>
            {steps.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Start with a trigger from the palette
              </p>
            )}
          </div>
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
                    />
                  </Reorder.Item>
                ) : (
                  <DraggableFlowNode
                    step={step}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === steps.length - 1}
                    onRemove={handleRemoveStep}
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
                      "border-2 border-dashed rounded-lg py-3 my-2 text-center transition-all",
                      dropTargetIndex === index + 1
                        ? "border-primary bg-primary/10"
                        : "border-border/30"
                    )}
                  >
                    <Plus
                      className={cn(
                        "w-4 h-4 mx-auto",
                        dropTargetIndex === index + 1
                          ? "text-primary"
                          : "text-muted-foreground/50"
                      )}
                    />
                  </motion.div>
                )}
              </div>
            ))}
          </Reorder.Group>
        </AnimatePresence>

        {/* Add Step Button (when not dragging) */}
        {steps.length > 0 && !isDraggingFromPalette && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center pt-4"
          >
            <div className="text-center">
              <div className="w-0.5 h-4 bg-border mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Drag more nodes from the palette
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
