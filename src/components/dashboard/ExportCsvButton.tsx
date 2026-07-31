import { Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import type { AnalyticsRange } from "./DateRangeFilter";

type Campaign = Tables<"campaigns">;

interface DashboardStats {
  campaigns: number;
  contacts: number;
  emailsSent: number;
  automations: number;
  openRate: number;
}

interface ExportCsvButtonProps {
  range: AnalyticsRange;
  stats: DashboardStats | undefined;
  campaigns: Campaign[] | undefined;
  disabled?: boolean;
}

const escapeCell = (value: unknown) => {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const toRow = (cells: unknown[]) => cells.map(escapeCell).join(",");

export const ExportCsvButton = ({ range, stats, campaigns, disabled }: ExportCsvButtonProps) => {
  const handleExport = () => {
    if (!stats && (!campaigns || campaigns.length === 0)) {
      toast({ title: "Nothing to export", description: "No data for the selected date range." });
      return;
    }

    const lines: string[] = [];

    lines.push(toRow(["Dashboard export"]));
    lines.push(toRow(["Range", range.label]));
    lines.push(toRow(["From", format(range.from, "yyyy-MM-dd HH:mm")]));
    lines.push(toRow(["To", format(range.to, "yyyy-MM-dd HH:mm")]));
    lines.push("");

    lines.push(toRow(["Metric", "Value"]));
    lines.push(toRow(["Campaigns", stats?.campaigns ?? 0]));
    lines.push(toRow(["New Contacts", stats?.contacts ?? 0]));
    lines.push(toRow(["Emails Sent", stats?.emailsSent ?? 0]));
    lines.push(toRow(["Active Automations", stats?.automations ?? 0]));
    lines.push(toRow(["Open Rate (%)", stats?.openRate ?? 0]));
    lines.push("");

    lines.push(toRow(["Recent Campaigns"]));
    lines.push(
      toRow(["Name", "Subject", "Status", "Sender Email", "Recipients", "Sent", "Created At"]),
    );
    (campaigns ?? []).forEach((c) => {
      lines.push(
        toRow([
          c.name,
          c.subject,
          c.status,
          c.sender_email,
          c.total_recipients ?? 0,
          c.sent_count ?? 0,
          format(new Date(c.created_at), "yyyy-MM-dd HH:mm"),
        ]),
      );
    });

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-${format(range.from, "yyyyMMdd")}-${format(range.to, "yyyyMMdd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Export ready", description: "Your CSV download has started." });
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={disabled} className="gap-2">
      <Download className="w-4 h-4" />
      Export CSV
    </Button>
  );
};