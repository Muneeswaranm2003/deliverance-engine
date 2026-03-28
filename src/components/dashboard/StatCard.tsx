import { motion } from "framer-motion";
import { LucideIcon, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  index: number;
  isLoading: boolean;
  trend?: number;
  suffix?: string;
}

const AnimatedCounter = ({ value, isLoading }: { value: number; isLoading: boolean }) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView || isLoading) return;
    const duration = 1500;
    const startTime = performance.now();
    let rafId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isInView, value, isLoading]);

  return <span ref={ref}>{isLoading ? "—" : display.toLocaleString()}</span>;
};

export const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  index,
  isLoading,
  trend,
  suffix = "",
}: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative glass rounded-xl p-6 hover:border-primary/40 transition-all duration-300 overflow-hidden cursor-default"
    >
      {/* Glow effect on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${bgColor} blur-3xl -z-10`} />

      <div className="flex items-center justify-between mb-4">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        ) : (
          <motion.div
            whileHover={{ rotate: 12, scale: 1.1 }}
            className={`w-11 h-11 rounded-xl ${bgColor} flex items-center justify-center shadow-lg`}
          >
            <Icon className={`w-5 h-5 ${color}`} />
          </motion.div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <p className="font-display text-4xl font-bold tracking-tight">
          <AnimatedCounter value={value} isLoading={isLoading} />
          {suffix && <span className="text-2xl ml-0.5">{suffix}</span>}
        </p>
        {trend !== undefined && !isLoading && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + index * 0.1 }}
            className={`flex items-center gap-0.5 text-xs font-semibold mb-1.5 px-2 py-0.5 rounded-full ${
              trend >= 0
                ? "text-emerald-400 bg-emerald-400/10"
                : "text-red-400 bg-red-400/10"
            }`}
          >
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
