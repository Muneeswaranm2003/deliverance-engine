import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mail, Shield, Zap, ArrowRight, Send, Users, BarChart3, TrendingUp, MousePointerClick, CheckCircle2 } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-pulse-glow" />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="container relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground font-medium">
              Enterprise-Grade Email Marketing Platform
            </span>
          </motion.div>

          {/* Headline */}
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Deliver Emails
            <br />
            <span className="text-gradient">With Confidence</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            High deliverability, intelligent automation, and customer-owned data storage. 
            Built for businesses that demand privacy and performance.
          </p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button variant="hero" size="xl">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="glass" size="xl">
              View Documentation
            </Button>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8 text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <span className="text-sm">99.2% Deliverability</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm">GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-sm">10M+ Emails/Day</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.9, ease: "easeOut" }}
          className="relative mt-12 sm:mt-16 md:mt-20 mx-auto max-w-5xl px-2 sm:px-0"
        >
          {/* Glow */}
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-3xl blur-2xl opacity-60" />

          <div className="relative glass rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-border/50 bg-background/40">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 flex justify-center min-w-0">
                <div className="px-2 sm:px-3 py-1 rounded-md bg-background/60 border border-border/50 text-[10px] sm:text-xs text-muted-foreground font-mono truncate max-w-full">
                  app.emailreach.io/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard body */}
            <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-br from-background/60 to-background/20">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
                <div className="text-left">
                  <h3 className="font-display font-bold text-base sm:text-lg">Dashboard</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Good afternoon, welcome back</p>
                </div>
                <div className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[10px] sm:text-xs font-medium text-primary whitespace-nowrap">
                  + New Campaign
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
                {[
                  { label: "Sent", value: "1.2M", icon: Send, color: "text-primary", bg: "bg-primary/10", trend: "+12%" },
                  { label: "Contacts", value: "48,291", icon: Users, color: "text-emerald-400", bg: "bg-emerald-400/10", trend: "+8%" },
                  { label: "Open Rate", value: "42.8%", icon: BarChart3, color: "text-violet-400", bg: "bg-violet-400/10", trend: "+3.2%" },
                  { label: "Clicks", value: "18.4%", icon: MousePointerClick, color: "text-amber-400", bg: "bg-amber-400/10", trend: "+1.7%" },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 + i * 0.08 }}
                    className="glass rounded-xl p-2.5 sm:p-3 text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                        <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                      </div>
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                        <TrendingUp className="w-2.5 h-2.5" /> {s.trend}
                      </span>
                    </div>
                    <p className="font-display font-bold text-base sm:text-lg leading-none">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Chart + side panel */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 sm:gap-3">
                <div className="md:col-span-3 glass rounded-xl p-3 sm:p-4 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium">Email Activity</p>
                    <span className="text-[10px] text-muted-foreground">Last 7 days</span>
                  </div>
                  {/* Fake bar chart */}
                  <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-20 sm:h-24">
                    {[45, 68, 52, 78, 62, 88, 74].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: 1.3 + i * 0.06, duration: 0.5 }}
                        className="flex-1 rounded-t bg-gradient-to-t from-primary/60 to-primary/20 border-t border-primary/40"
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-[9px] text-muted-foreground">
                    {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <span key={d}>{d}</span>)}
                  </div>
                </div>

                <div className="md:col-span-2 glass rounded-xl p-3 sm:p-4 text-left">
                  <p className="text-xs font-medium mb-3">Recent Campaigns</p>
                  <div className="space-y-2.5">
                    {[
                      { name: "Q3 Newsletter", status: "Delivered" },
                      { name: "Product Launch", status: "Sending" },
                      { name: "Welcome Series", status: "Delivered" },
                    ].map((c, i) => (
                      <motion.div
                        key={c.name}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.4 + i * 0.1 }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate">{c.name}</p>
                          <p className="text-[9px] text-muted-foreground">{c.status}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <motion.div
            initial={{ opacity: 0, x: -30, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 1.6, duration: 0.6 }}
            className="hidden lg:flex absolute -left-6 top-1/3 glass rounded-xl p-3 items-center gap-2 shadow-xl animate-float"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold">99.2% Delivered</p>
              <p className="text-[9px] text-muted-foreground">Last 24h</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay: 1.8, duration: 0.6 }}
            className="hidden lg:flex absolute -right-6 bottom-1/4 glass rounded-xl p-3 items-center gap-2 shadow-xl animate-float"
            style={{ animationDelay: "2s" }}
          >
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-semibold">Campaign Sent</p>
              <p className="text-[9px] text-primary">24,847 recipients</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
