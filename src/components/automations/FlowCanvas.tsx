import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Workflow, Zap, ArrowDown } from "lucide-react";
import { FlowStep } from "./flowTypes";
import { DraggableFlowNode } from "./DraggableFlowNode";
import { BranchingFlowNode } from "./BranchingFlowNode";
import { Button } from "@/components/ui/button";

interface FlowCanvasProps {
  steps: FlowStep[];
  onStepsChange: (steps: FlowStep[]) => void;
  isDraggingFromPalette: boolean;
  onConfigureStep?: (step: FlowStep) => void;
}

const CanvasDropZone = ({
  id,
  isDraggingFromPalette,
  isFirst,
  isEmpty,
}: {
  id: string;
  isDraggingFromPalette: boolean;
  isFirst?: boolean;
  isEmpty?: boolean;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { source: "canvas-drop", targetId: id },
  });

  if (!isDraggingFromPalette && !isEmpty) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-2 border-dashed rounded-xl text-center transition-all duration-200",
        isFirst ? "p-6 mb-4" : "py-3 my-2",
        isOver
          ? "border-primary bg-primary/5 scale-[1.01] shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
          : isFirst
          ? "border-border/40 bg-secondary/10"
          : "border-border/20",
        isFirst && isEmpty && "min-h-[160px] flex flex-col items-center justify-center"
      )}
      data-testid={`drop-zone-${id}`}
    >
      <div
        className={cn(
          "rounded-xl flex items-center justify-center mx-auto transition-colors",
          isFirst ? "w-10 h-10 mb-2" : "w-6 h-6",
          isOver ? "bg-primary/10" : "bg-secondary/40"
        )}
      >
        <Plus
          className={cn(
            isFirst ? "w-5 h-5" : "w-4 h-4",
            isOver ? "text-primary" : "text-muted-foreground/50"
          )}
        />
      </div>
      {isFirst && (
        <p
          className={cn(
            "text-xs font-medium",
            isOver ? "text-primary" : "text-muted-foreground"
          )}
        >
          {isEmpty ? "Drop your first node here" : "Drop here to add at start"}
        </p>
      )}
    </div>
  );
};

export const FlowCanvas = ({
  steps,
  onStepsChange,
  isDraggingFromPalette,
  onConfigureStep,
}: FlowCanvasProps) => {
  const handleRemoveStep = useCallback(
    (id: string) => {
      onStepsChange(steps.filter((s) => s.id !== id));
    },
    [steps, onStepsChange]
  );

  const handleUpdateStep = useCallback(
    (id: string, updates: Partial<FlowStep>) => {
      onStepsChange(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    },
    [steps, onStepsChange]
  );

  const handleClearAll = useCallback(() => {
    onStepsChange([]);
  }, [onStepsChange]);

  return (
    <div className="flex-1 min-h-0 overflow-auto relative bg-[hsl(var(--background))]">
      {/* Dot grid background - Langflow style */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--foreground) / 0.08) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, hsl(var(--primary) / 0.04), transparent 70%)",
        }}
      />

      <div className="relative z-10 p-6">
        <div className="max-w-md mx-auto">
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

          {/* Empty state (no drag) */}
          {steps.length === 0 && !isDraggingFromPalette && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-2 border-dashed border-border/50 rounded-2xl p-10 text-center mb-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-primary/40" />
              </div>
              <h4 className="text-sm font-semibold mb-1">
                Build Your Automation
              </h4>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                Drag a trigger from the components panel — or hover and click the
                "+" to add it.
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

          {/* Top drop zone */}
          {(isDraggingFromPalette || steps.length === 0) && (
            <CanvasDropZone
              id="drop-0"
              isDraggingFromPalette={isDraggingFromPalette || steps.length === 0}
              isFirst
              isEmpty={steps.length === 0}
            />
          )}

          {/* Flow Steps - Sortable */}
          <SortableContext
            items={steps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence mode="popLayout">
              <div className="space-y-0">
                {steps.map((step, index) => (
                  <div key={step.id}>
                    {step.type === "condition" ? (
                      <BranchingFlowNode
                        step={step}
                        index={index}
                        isFirst={index === 0}
                        isLast={index === steps.length - 1}
                        onRemove={handleRemoveStep}
                        onUpdateStep={handleUpdateStep}
                        isDraggingFromPalette={isDraggingFromPalette}
                        onConfigureStep={onConfigureStep}
                      />
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
                    <CanvasDropZone
                      id={`drop-${index + 1}`}
                      isDraggingFromPalette={isDraggingFromPalette}
                    />
                  </div>
                ))}
              </div>
            </AnimatePresence>
          </SortableContext>

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
