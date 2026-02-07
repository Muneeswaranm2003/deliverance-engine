import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NodePalette } from "./NodePalette";
import { FlowCanvas } from "./FlowCanvas";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { FlowStep, NodeConfig, flattenSteps } from "./flowTypes";
import { Loader2, Workflow, Save } from "lucide-react";
 
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
 
 export const MultiStepFlowBuilder = ({
   onSubmit,
   onCancel,
   isSaving,
   initialData,
 }: MultiStepFlowBuilderProps) => {
   const [name, setName] = useState(initialData?.name || "");
   const [description, setDescription] = useState(initialData?.description || "");
   const [steps, setSteps] = useState<FlowStep[]>(initialData?.steps || []);
    const [isDraggingFromPalette, setIsDraggingFromPalette] = useState(false);
    const [draggedNode, setDraggedNode] = useState<NodeConfig | null>(null);
    const [configuringStep, setConfiguringStep] = useState<FlowStep | null>(null);
 
   const handleDragStart = useCallback((node: NodeConfig) => {
     setDraggedNode(node);
     setIsDraggingFromPalette(true);
   }, []);
 
   const handleDragEnd = useCallback(() => {
     setDraggedNode(null);
     setIsDraggingFromPalette(false);
   }, []);
 
    const handleSubmit = useCallback(() => {
      if (!name.trim()) return;
      if (steps.length === 0) return;
      onSubmit({ name, description, steps });
    }, [name, description, steps, onSubmit]);

    const handleConfigureStep = useCallback((step: FlowStep) => {
      setConfiguringStep(step);
    }, []);

    const handleSaveConfig = useCallback((stepId: string, config: Record<string, unknown>) => {
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
    }, [steps]);
 
    const allSteps = flattenSteps(steps);
    const hasTrigger = allSteps.some((s) => s.type === "trigger");
    const hasAction = allSteps.some((s) => s.type === "action");
    const isValid = name.trim() && hasTrigger && hasAction;
 
   return (
     <div className="flex flex-col h-[70vh]">
       {/* Header with name input */}
       <div className="shrink-0 p-4 border-b border-border bg-secondary/30">
         <div className="flex items-start gap-4">
           <div className="flex-1 space-y-3">
             <div className="space-y-1.5">
               <Label htmlFor="flow-name" className="text-xs">Automation Name</Label>
               <Input
                 id="flow-name"
                 placeholder="e.g., Welcome series for new subscribers"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 className="h-9"
               />
             </div>
             <div className="space-y-1.5">
               <Label htmlFor="flow-description" className="text-xs">Description (optional)</Label>
               <Textarea
                 id="flow-description"
                 placeholder="Describe what this automation does..."
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 className="resize-none h-16 text-sm"
               />
             </div>
           </div>
         </div>
       </div>
 
       {/* Main content area */}
       <div className="flex flex-1 min-h-0">
         {/* Node Palette */}
         <NodePalette onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
 
          {/* Flow Canvas */}
          <FlowCanvas
            steps={steps}
            onStepsChange={setSteps}
            isDraggingFromPalette={isDraggingFromPalette}
            draggedNode={draggedNode}
            onConfigureStep={handleConfigureStep}
          />

          {/* Node Config Panel */}
          {configuringStep && (
            <NodeConfigPanel
              step={configuringStep}
              onSave={handleSaveConfig}
              onClose={() => setConfiguringStep(null)}
            />
          )}
       </div>
 
       {/* Footer */}
       <div className="shrink-0 p-4 border-t border-border bg-secondary/30">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Workflow className="w-4 h-4" />
              <span>
                {allSteps.length} step{allSteps.length !== 1 ? "s" : ""} configured
              </span>
              {!hasTrigger && allSteps.length > 0 && (
                <span className="text-warning">• Needs a trigger</span>
              )}
              {!hasAction && allSteps.length > 0 && (
                <span className="text-warning">• Needs an action</span>
              )}
              {steps.some((s) => s.type === "condition") && (
                <span className="text-violet-500">• Has branching</span>
              )}
            </div>
           <div className="flex gap-3">
             <Button variant="outline" onClick={onCancel}>
               Cancel
             </Button>
             <Button
               variant="hero"
               onClick={handleSubmit}
               disabled={isSaving || !isValid}
             >
               {isSaving ? (
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
               ) : (
                 <Save className="w-4 h-4 mr-2" />
               )}
               Save Automation
             </Button>
           </div>
         </div>
       </div>
     </div>
   );
 };