import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FlowNodeProps {
  type: "trigger" | "delay" | "action";
  icon: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
  active?: boolean;
}

const nodeStyles = {
  trigger: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-500",
    glow: "shadow-[0_0_20px_hsl(142_76%_36%/0.15)]",
  },
  delay: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-500",
    glow: "shadow-[0_0_20px_hsl(38_92%_50%/0.15)]",
  },
  action: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
    glow: "shadow-[0_0_20px_hsl(var(--primary)/0.15)]",
  },
};

export const FlowNode = ({
  type,
  icon,
  title,
  subtitle,
  className,
  active = true,
}: FlowNodeProps) => {
  const styles = nodeStyles[type];

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm transition-all",
        styles.bg,
        styles.border,
        active && styles.glow,
        !active && "opacity-50",
        className
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          styles.iconBg
        )}
      >
        <span className={styles.iconColor}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export const FlowConnector = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex items-center justify-center py-1", className)}>
      <div className="w-0.5 h-6 bg-gradient-to-b from-border via-primary/40 to-border relative">
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-primary/50" />
      </div>
    </div>
  );
};

export const FlowConnectorHorizontal = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex items-center px-1", className)}>
      <div className="h-0.5 w-8 bg-gradient-to-r from-border via-primary/40 to-border relative">
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent border-l-primary/50" />
      </div>
    </div>
  );
};
