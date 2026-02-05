 import { LucideIcon } from "lucide-react";
 
 export interface FlowStep {
   id: string;
   type: "trigger" | "delay" | "action" | "condition";
   nodeType: string;
   config?: Record<string, unknown>;
 }
 
 export interface NodeConfig {
   id: string;
   name: string;
   icon: LucideIcon;
   category: "trigger" | "delay" | "action" | "condition";
   description?: string;
 }
 
 export const nodeStyles = {
   trigger: {
     bg: "bg-emerald-500/10",
     border: "border-emerald-500/30",
     iconBg: "bg-emerald-500/20",
     iconColor: "text-emerald-500",
     glow: "shadow-[0_0_20px_hsl(142_76%_36%/0.15)]",
     accent: "emerald",
   },
   delay: {
     bg: "bg-amber-500/10",
     border: "border-amber-500/30",
     iconBg: "bg-amber-500/20",
     iconColor: "text-amber-500",
     glow: "shadow-[0_0_20px_hsl(38_92%_50%/0.15)]",
     accent: "amber",
   },
   action: {
     bg: "bg-primary/10",
     border: "border-primary/30",
     iconBg: "bg-primary/20",
     iconColor: "text-primary",
     glow: "shadow-[0_0_20px_hsl(var(--primary)/0.15)]",
     accent: "primary",
   },
   condition: {
     bg: "bg-violet-500/10",
     border: "border-violet-500/30",
     iconBg: "bg-violet-500/20",
     iconColor: "text-violet-500",
     glow: "shadow-[0_0_20px_hsl(270_70%_50%/0.15)]",
     accent: "violet",
   },
 } as const;