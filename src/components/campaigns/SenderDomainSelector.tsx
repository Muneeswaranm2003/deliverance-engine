import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Mail, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Star,
  Info
} from "lucide-react";

interface SenderDomain {
  id: string;
  user_id: string;
  display_order: number;
  domain_name: string;
  from_email: string;
  from_name: string;
  is_verified: boolean;
  is_default: boolean;
}

interface SelectedSender {
  id: string;
  order: number;
  from_email: string;
  from_name: string;
}

interface SenderDomainSelectorProps {
  selectedSenders: SelectedSender[];
  onSelectedSendersChange: (senders: SelectedSender[]) => void;
}

export const SenderDomainSelector = ({ 
  selectedSenders, 
  onSelectedSendersChange 
}: SenderDomainSelectorProps) => {
  const { user } = useAuth();

  const { data: senderDomains, isLoading } = useQuery({
    queryKey: ["sender_domains", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("sender_domains")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as SenderDomain[];
    },
    enabled: !!user?.id,
  });

  // Auto-select default domain on first load
  useEffect(() => {
    if (senderDomains && senderDomains.length > 0 && selectedSenders.length === 0) {
      const defaultDomain = senderDomains.find(d => d.is_default) || senderDomains[0];
      onSelectedSendersChange([{
        id: defaultDomain.id,
        order: 1,
        from_email: defaultDomain.from_email,
        from_name: defaultDomain.from_name,
      }]);
    }
  }, [senderDomains, selectedSenders.length, onSelectedSendersChange]);

  const toggleSender = (domain: SenderDomain) => {
    const isSelected = selectedSenders.some(s => s.id === domain.id);
    
    if (isSelected) {
      // Remove and reorder
      const remaining = selectedSenders
        .filter(s => s.id !== domain.id)
        .map((s, idx) => ({ ...s, order: idx + 1 }));
      onSelectedSendersChange(remaining);
    } else {
      // Add with next order
      if (selectedSenders.length >= 5) {
        return; // Max 5 already selected
      }
      const newSender: SelectedSender = {
        id: domain.id,
        order: selectedSenders.length + 1,
        from_email: domain.from_email,
        from_name: domain.from_name,
      };
      onSelectedSendersChange([...selectedSenders, newSender]);
    }
  };

  const getSelectedOrder = (domainId: string): number | null => {
    const sender = selectedSenders.find(s => s.id === domainId);
    return sender ? sender.order : null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!senderDomains || senderDomains.length === 0) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-500">No Sender Domains Configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Go to Settings → Sender Domains to configure your sending domains before creating a campaign.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-medium">Sender Domains</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Select up to 5 domains. Emails will be sent using these domains in the selected order (1, 2, 3...).
        </p>
      </div>

      <div className="grid gap-2">
        {senderDomains.map((domain) => {
          const selectedOrder = getSelectedOrder(domain.id);
          const isSelected = selectedOrder !== null;
          const isDisabled = !isSelected && selectedSenders.length >= 5;

          return (
            <div
              key={domain.id}
              onClick={() => !isDisabled && toggleSender(domain)}
              className={`
                flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                ${isSelected 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                  : isDisabled 
                    ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed'
                    : 'border-border bg-secondary/30 hover:border-primary/50'
                }
              `}
            >
              <Checkbox 
                checked={isSelected}
                disabled={isDisabled}
                className="pointer-events-none"
              />
              
              {isSelected && (
                <Badge className="font-mono bg-primary text-primary-foreground">
                  #{selectedOrder}
                </Badge>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span className="font-medium truncate">{domain.from_name}</span>
                  {domain.is_default && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="w-3 h-3" />
                      Default
                    </Badge>
                  )}
                  {domain.is_verified ? (
                    <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
                      <CheckCircle className="w-3 h-3" />
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {domain.from_email}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {selectedSenders.length > 0 && (
        <div className="p-3 rounded-lg bg-secondary/50 border border-border">
          <p className="text-sm font-medium mb-2">Sending Order:</p>
          <div className="flex flex-wrap gap-2">
            {selectedSenders
              .sort((a, b) => a.order - b.order)
              .map((sender) => (
                <Badge key={sender.id} variant="outline" className="gap-1">
                  #{sender.order} {sender.from_name}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SenderDomainSelector;
