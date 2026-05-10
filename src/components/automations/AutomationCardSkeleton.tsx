import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const AutomationCardSkeleton = () => (
  <Card className="glass">
    <CardHeader className="pb-3 border-b border-border/50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-6 w-10 rounded-full" />
      </div>
    </CardHeader>
    <CardContent className="py-4 space-y-4">
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </CardContent>
  </Card>
);
