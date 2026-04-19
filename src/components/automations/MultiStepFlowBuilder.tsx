import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NodePalette } from "./NodePalette";
import { FlowCanvas } from "./FlowCanvas";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { FlowStep, NodeConfig, flattenSteps, nodeStyles } from "./flowTypes";
import {
  Loader2,
  Workflow,
  Save,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MultiStepFlowBuilderProps {
  onSubmit: (data: {
    name: string;
    description: string;
    steps: FlowStep[];
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
  initialData?: {
    name: string;
    description: string;
    steps: FlowStep[];
  };
}

const generateStepId = () =>
  `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const buildStepFromNode = (node: NodeConfig): FlowStep => ({
  id: generateStepId(),
  type: node.category,
  nodeType: node.id,
  ...(node.category === "condition" ? { yesBranch: [], noBranch: [] } : {}),
});

export const MultiStepFlowBuilder = ({
  onSubmit,
  onCancel,
  isSaving,
  initialData,
}: MultiStepFlowBuilderProps) => {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [steps, setSteps] = useState<FlowStep[]>(initialData?.steps || []);
  const [activeDragNode, setActiveDragNode] = useState<NodeConfig | null>(null);
  const [configuringStep, setConfiguringStep] = useState<FlowStep | null>(null);
  // Wizard: step 1 = name/details, step 2 = flow builder.
  // If editing existing automation with steps, jump straight to builder.
  const [wizardStep, setWizardStep] = useState<"details" | "builder">(
    initialData && initialData.steps.length > 0 ? "builder" : "details"
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleAddNode = useCallback((node: NodeConfig) => {
    // Click-to-add: append to end
    setSteps((prev) => [...prev, buildStepFromNode(node)]);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.source === "palette" && data.node) {
      setActiveDragNode(data.node as NodeConfig);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const activeData = active.data.current;
      const overData = over?.data.current;

      setActiveDragNode(null);

      if (!over) return;

      // Case 1: Palette → canvas drop zone
      if (activeData?.source === "palette" && overData?.source === "canvas-drop") {
        const node = activeData.node as NodeConfig;
        const targetId = overData.targetId as string; // e.g., "drop-0", "drop-1"
        const insertIndex = parseInt(targetId.replace("drop-", ""), 10);
        const newStep = buildStepFromNode(node);
        setSteps((prev) => {
          const next = [...prev];
          next.splice(insertIndex, 0, newStep);
          return next;
        });
        return;
      }

      // Case 2: Palette → branch drop
      if (activeData?.source === "palette" && overData?.source === "branch-drop") {
        const node = activeData.node as NodeConfig;
        const parentStepId = overData.stepId as string;
        const branch = overData.branch as "yes" | "no";
        const newStep = buildStepFromNode(node);
        setSteps((prev) =>
          prev.map((s) => {
            if (s.id !== parentStepId) return s;
            if (branch === "yes") {
              return { ...s, yesBranch: [...(s.yesBranch || []), newStep] };
            }
            return { ...s, noBranch: [...(s.noBranch || []), newStep] };
          })
        );
        return;
      }

      // Case 3: Canvas reorder
      if (activeData?.source === "canvas" && over.id !== active.id) {
        const oldIndex = steps.findIndex((s) => s.id === active.id);
        const newIndex = steps.findIndex((s) => s.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          setSteps((prev) => arrayMove(prev, oldIndex, newIndex));
        }
      }
    },
    [steps]
  );

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return;
    if (steps.length === 0) return;
    onSubmit({ name, description, steps });
  }, [name, description, steps, onSubmit]);

  const handleConfigureStep = useCallback((step: FlowStep) => {
    setConfiguringStep(step);
  }, []);

  const handleSaveConfig = useCallback(
    (stepId: string, config: Record<string, unknown>) => {
      const updateStepConfig = (items: FlowStep[]): FlowStep[] =>
        items.map((s) => {
          if (s.id === stepId) return { ...s, config };
          return {
            ...s,
            yesBranch: s.yesBranch ? updateStepConfig(s.yesBranch) : s.yesBranch,
            noBranch: s.noBranch ? updateStepConfig(s.noBranch) : s.noBranch,
          };
        });
      setSteps(updateStepConfig(steps));
    },
    [steps]
  );

  const allSteps = flattenSteps(steps);
  const hasTrigger = allSteps.some((s) => s.type === "trigger");
  const hasAction = allSteps.some((s) => s.type === "action");
  const hasBranching = steps.some((s) => s.type === "condition");
  const isValid = name.trim() && hasTrigger && hasAction;
  const isDraggingFromPalette = activeDragNode !== null;

  // ============================================================
  // STEP 1: Name & description (clean focused intro screen)
  // ============================================================
  if (wizardStep === "details") {
    const canContinue = name.trim().length > 0;
    return (
      <div className="flex flex-col h-[75vh]">
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-xl mx-auto space-y-6">
            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">
                  {initialData ? "Edit your automation" : "Name your automation"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Give it a clear name so you can find it later. You'll build the flow next.
                </p>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-semibold">
                  1
                </span>
                <span className="font-medium text-foreground">Details</span>
              </span>
              <div className="w-8 h-px bg-border" />
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-semibold">
                  2
                </span>
                <span>Build flow</span>
              </span>
            </div>

            {/* Form */}
            <div className="space-y-5 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-6">
              <div className="space-y-2">
                <Label htmlFor="flow-name" className="text-sm font-semibold">
                  Automation name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="flow-name"
                  placeholder="e.g., Welcome series for new subscribers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canContinue) setWizardStep("builder");
                  }}
                  autoFocus
                  className="h-11 bg-secondary/30 border-border/60 focus:border-primary/60 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Used to identify this automation across your dashboard.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="flow-description" className="text-sm font-semibold">
                  Description{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="flow-description"
                  placeholder="Describe what this automation does and when it should run..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none h-20 text-sm bg-secondary/30 border-border/60"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border/50 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between max-w-xl mx-auto w-full">
            <Button variant="outline" size="sm" onClick={onCancel} className="h-9">
              Cancel
            </Button>
            <Button
              variant="hero"
              size="sm"
              onClick={() => setWizardStep("builder")}
              disabled={!canContinue}
              className="h-9"
            >
              Continue to flow builder
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // STEP 2: Flow builder (palette + canvas + config)
  // ============================================================
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-[75vh]">
        {/* Compact header showing the named automation */}
        <div className="shrink-0 px-5 py-3 border-b border-border/50 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWizardStep("details")}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Workflow className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold truncate">{name}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWizardStep("details")}
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  Edit details
                </Button>
              </div>
              {description && (
                <p className="text-xs text-muted-foreground truncate">{description}</p>
              )}
            </div>
            <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-semibold">
                2
              </span>
              Build flow
            </Badge>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          <NodePalette onAddNode={handleAddNode} />

          <FlowCanvas
            steps={steps}
            onStepsChange={setSteps}
            isDraggingFromPalette={isDraggingFromPalette}
            onConfigureStep={handleConfigureStep}
          />

          {configuringStep && (
            <NodeConfigPanel
              step={configuringStep}
              onSave={handleSaveConfig}
              onClose={() => setConfiguringStep(null)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border/50 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] gap-1 font-medium",
                  hasTrigger
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                    : "border-border text-muted-foreground"
                )}
              >
                {hasTrigger ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                Trigger
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] gap-1 font-medium",
                  hasAction
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                    : "border-border text-muted-foreground"
                )}
              >
                {hasAction ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                Action
              </Badge>
              {hasBranching && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 font-medium border-violet-500/30 text-violet-500 bg-violet-500/5"
                >
                  <GitBranch className="w-3 h-3" />
                  Branching
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground ml-1">
                {allSteps.length} step{allSteps.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} className="h-9">
                Cancel
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={handleSubmit}
                disabled={isSaving || !isValid}
                className="h-9"
                data-testid="save-automation"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1.5" />
                )}
                Save Automation
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay - floating preview while dragging from palette */}
      <DragOverlay>
        {activeDragNode && (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg backdrop-blur-md",
              nodeStyles[activeDragNode.category].bg,
              nodeStyles[activeDragNode.category].border
            )}
          >
            <div
              className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center",
                nodeStyles[activeDragNode.category].iconBg
              )}
            >
              <activeDragNode.icon
                className={cn("w-3 h-3", nodeStyles[activeDragNode.category].iconColor)}
              />
            </div>
            <span className="text-xs font-medium">{activeDragNode.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};
