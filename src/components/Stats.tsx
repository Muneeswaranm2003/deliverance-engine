import { motion } from "framer-motion";

const stats = [
  { value: "99.2%", label: "Deliverability Rate" },
  { value: "10M+", label: "Emails Sent Daily" },
  { value: "2,500+", label: "Enterprise Clients" },
  { value: "<50ms", label: "API Response Time" },
];

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
                {stat.value}
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
