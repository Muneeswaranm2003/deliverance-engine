import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  Check,
  AlertCircle,
  Calendar,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AutomationAnalyticsProps {
  automation: {
    id: string;
    name: string;
    type: "campaign" | "followup";
    triggered_count: number;
    completed_count: number;
    created_at: string;
  };
}

// Mock data - replace with real data from API
const generateMockData = () => {
  const data = [];
  for (let i = 0; i < 30; i++) {
    data.push({
      day: `Day ${i + 1}`,
      triggered: Math.floor(Math.random() * 100) + 20,
      completed: Math.floor(Math.random() * 80) + 10,
    });
  }
  return data;
};

const mockHourlyData = [
  { time: "00:00", count: 12 },
  { time: "04:00", count: 8 },
  { time: "08:00", count: 45 },
  { time: "12:00", count: 78 },
  { time: "16:00", count: 92 },
  { time: "20:00", count: 65 },
];

const performanceData = [
  { name: "Success", value: 75, color: "#10b981" },
  { name: "Pending", value: 15, color: "#3b82f6" },
  { name: "Failed", value: 10, color: "#ef4444" },
];

export const AutomationAnalytics = ({ automation }: AutomationAnalyticsProps) => {
  const chartData = generateMockData();
  const completionRate = automation.triggered_count > 0
    ? Math.round((automation.completed_count / automation.triggered_count) * 100)
    : 0;
  const failureRate = 100 - completionRate;
  const daysActive = Math.floor(
    (new Date().getTime() - new Date(automation.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const stats = [
    {
      label: "Total Triggered",
      value: automation.triggered_count,
      icon: Zap,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Completed",
      value: automation.completed_count,
      icon: Check,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Success Rate",
      value: `${completionRate}%`,
      icon: TrendingUp,
      color: completionRate >= 75 ? "text-emerald-500" : "text-amber-500",
      bgColor: completionRate >= 75 ? "bg-emerald-500/10" : "bg-amber-500/10",
    },
    {
      label: "Days Active",
      value: daysActive || 1,
      icon: Calendar,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{automation.name}</h2>
        <Badge
          variant="outline"
          className={cn(
            "capitalize",
            automation.type === "campaign"
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900"
          )}
        >
          {automation.type}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="glass hover:shadow-lg transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                    <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                      <Icon className={cn("w-4 h-4", stat.color)} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Triggered vs Completed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart className="w-4 h-4" />
                Daily Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 12 }}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="triggered" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Performance Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={performanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {performanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {performanceData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                    </span>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Hourly Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Hourly Distribution (Last 24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={mockHourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Insights & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completionRate < 50 ? (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
                  <p className="text-sm font-medium text-destructive">Low completion rate</p>
                  <p className="text-xs text-muted-foreground">
                    Consider reviewing your trigger conditions or action settings.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Great performance!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your automation is running smoothly with {completionRate}% success rate.
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Peak hours</p>
                <p className="text-xs text-muted-foreground">
                  Most of your automations run between 12:00 PM and 8:00 PM.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Optimization</p>
                <p className="text-xs text-muted-foreground">
                  Try scheduling actions during peak hours for better engagement.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
