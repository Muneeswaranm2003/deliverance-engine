import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Clock, Users, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TimezoneDistributionProps {
  recipientEmails: string[];
}

interface TimezoneGroup {
  timezone: string;
  count: number;
  deliveryWindow: string;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

const getDeliveryWindow = (tz: string): string => {
  return "10:00 AM – 4:00 PM local";
};

const getUtcOffset = (tz: string): string => {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    return offsetPart?.value || tz;
  } catch {
    return tz;
  }
};

const TimezoneDistribution = ({ recipientEmails }: TimezoneDistributionProps) => {
  const [groups, setGroups] = useState<TimezoneGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [noTimezone, setNoTimezone] = useState(0);

  useEffect(() => {
    if (recipientEmails.length === 0) {
      setGroups([]);
      setNoTimezone(0);
      return;
    }

    const fetchTimezones = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("contacts")
          .select("email, timezone")
          .in("email", recipientEmails.slice(0, 500));

        if (error) throw error;

        // For emails beyond 500, fetch in batches
        let allData = data || [];
        if (recipientEmails.length > 500) {
          for (let i = 500; i < recipientEmails.length; i += 500) {
            const batch = recipientEmails.slice(i, i + 500);
            const { data: batchData } = await supabase
              .from("contacts")
              .select("email, timezone")
              .in("email", batch);
            if (batchData) allData = [...allData, ...batchData];
          }
        }

        const tzMap = new Map<string, number>();
        let missing = 0;

        const contactTzMap = new Map(allData.map((c) => [c.email.toLowerCase(), c.timezone]));

        for (const email of recipientEmails) {
          const tz = contactTzMap.get(email.toLowerCase());
          if (tz) {
            tzMap.set(tz, (tzMap.get(tz) || 0) + 1);
          } else {
            missing++;
          }
        }

        const sorted = Array.from(tzMap.entries())
          .map(([timezone, count]) => ({
            timezone,
            count,
            deliveryWindow: getDeliveryWindow(timezone),
          }))
          .sort((a, b) => b.count - a.count);

        setGroups(sorted);
        setNoTimezone(missing);
      } catch (err) {
        console.error("Error fetching timezone data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimezones();
  }, [recipientEmails]);

  if (recipientEmails.length === 0) return null;

  const maxCount = Math.max(...groups.map((g) => g.count), 1);

  return (
    <Card className="bg-secondary/30 border-border">
      <CardContent className="pt-5 pb-4 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Timezone Delivery Preview</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {recipientEmails.length} recipients
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 && noTimezone > 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No timezone data available. Contacts without timezone info will receive emails based on the campaign schedule.
          </p>
        ) : (
          <TooltipProvider>
            <div className="space-y-2">
              {groups.map((group) => (
                <div key={group.timezone} className="flex items-center gap-3">
                  <div className="w-36 shrink-0 truncate">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-default">
                          {getUtcOffset(group.timezone)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-xs">{group.timezone}</p>
                        <p className="text-xs text-muted-foreground">
                          Delivery: 10 AM – 4 PM local
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex-1 h-5 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-500"
                      style={{ width: `${(group.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <div className="w-16 shrink-0 text-right">
                    <span className="text-xs font-medium">{group.count}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({Math.round((group.count / recipientEmails.length) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}

              {noTimezone > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-36 shrink-0">
                    <span className="text-xs text-muted-foreground italic">No timezone</span>
                  </div>
                  <div className="flex-1 h-5 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-muted-foreground/30 rounded-full transition-all duration-500"
                      style={{ width: `${(noTimezone / maxCount) * 100}%` }}
                    />
                  </div>
                  <div className="w-16 shrink-0 text-right">
                    <span className="text-xs font-medium">{noTimezone}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({Math.round((noTimezone / recipientEmails.length) * 100)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </TooltipProvider>
        )}

        <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border">
          <Clock className="w-3 h-3" />
          Emails are delivered between 10 AM – 4 PM in each recipient's local time
        </p>
      </CardContent>
    </Card>
  );
};

export default TimezoneDistribution;
