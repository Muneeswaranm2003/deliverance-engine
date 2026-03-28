import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const stats = [
  { value: 99.2, suffix: "%", label: "Deliverability Rate", decimals: 1 },
  { value: 10, suffix: "M+", label: "Emails Sent Daily", decimals: 0 },
  { value: 2500, suffix: "+", label: "Enterprise Clients", decimals: 0, format: true },
  { value: 50, prefix: "<", suffix: "ms", label: "API Response Time", decimals: 0 },
];

const AnimatedNumber = ({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  format = false,
  delay = 0,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  format?: boolean;
  delay?: number;
}) => {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000;
    const startTime = performance.now() + delay * 1000;
    let rafId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed < 0) {
        rafId = requestAnimationFrame(animate);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(eased * value);
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isInView, value, delay]);

  const formatted = format
    ? Math.round(display).toLocaleString()
    : display.toFixed(decimals);

  return (
    <span ref={ref}>
      {prefix}{formatted}{suffix}
    </span>
  );
};

const Stats = () => {
  return (
    <section className="py-16 relative border-y border-border/50">
      <div className="container px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <p className="font-display text-3xl md:text-4xl font-bold text-gradient mb-2">
                <AnimatedNumber
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix || ""}
                  decimals={stat.decimals}
                  format={stat.format || false}
                  delay={index * 0.1}
                />
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
