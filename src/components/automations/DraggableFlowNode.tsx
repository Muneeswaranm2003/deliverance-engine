 import { useMemo } from "react";
 import { motion, Reorder, useDragControls } from "framer-motion";
 import { cn } from "@/lib/utils";
 import { GripVertical, X, Settings } from "lucide-react";
 import { FlowStep, nodeStyles } from "./flowTypes";
 import { nodeCategories } from "./NodePalette";
 import { Button } from "@/components/ui/button";
 
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
 
   return (
     <div className="relative">
       {/* Connector line from previous node */}
       {!isFirst && (
         <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 flex flex-col items-center">
           <div className="w-0.5 h-full bg-gradient-to-b from-border to-primary/40" />
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
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.9 }}
           className={cn(
             "relative flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm",
             styles.bg,
             styles.border,
             styles.glow
           )}
         >
           {/* Drag Handle */}
           <button
             className="cursor-grab active:cursor-grabbing touch-none"
             onPointerDown={(e) => dragControls.start(e)}
           >
             <GripVertical className="w-4 h-4 text-muted-foreground" />
           </button>
 
           {/* Step Number */}
           <div
             className={cn(
               "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
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
                 "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                 styles.iconBg
               )}
             >
               <Icon className={cn("w-5 h-5", styles.iconColor)} />
             </div>
           )}
 
           {/* Content */}
           <div className="min-w-0 flex-1">
             <p className="font-medium text-sm truncate">{nodeConfig?.name || step.nodeType}</p>
             <p className="text-xs text-muted-foreground capitalize">{step.type}</p>
           </div>
 
           {/* Actions */}
           <div className="flex items-center gap-1">
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
         </motion.div>
       </Reorder.Item>
 
       {/* Connector line to next node */}
       {!isLast && (
         <div className="flex flex-col items-center py-1">
           <div className="w-0.5 h-4 bg-gradient-to-b from-primary/40 to-border" />
           <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-primary/50" />
         </div>
       )}
     </div>
   );
 };