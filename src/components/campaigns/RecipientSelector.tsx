import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Upload, 
  Users, 
  FileSpreadsheet, 
  X, 
  Check,
  AlertCircle,
  ListFilter,
  Loader2,
  Plus
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Recipient {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

interface RecipientSelectorProps {
  recipients: Recipient[];
  onRecipientsChange: (recipients: Recipient[]) => void;
}

interface SegmentFilters {
  status?: string;
  engagement?: string;
  company?: string;
  suppressed?: string;
  searchQuery?: string;
}

interface ListSegment {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  filters: SegmentFilters;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  status: string | null;
  engagement_score: number | null;
  suppressed: boolean | null;
}

const RecipientSelector = ({ recipients, onRecipientsChange }: RecipientSelectorProps) => {
  const [activeTab, setActiveTab] = useState("upload");
  const [manualEmails, setManualEmails] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loadingSegment, setLoadingSegment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch saved segments
  const { data: segments, isLoading: segmentsLoading } = useQuery({
    queryKey: ["list-segments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_segments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ListSegment[];
    },
  });

  // Apply filters to contacts (matching ListSegmentation logic)
  const applyFilters = (contacts: Contact[], filterSet: SegmentFilters): Contact[] => {
    return contacts.filter((contact) => {
      if (filterSet.status && filterSet.status !== "all" && contact.status !== filterSet.status) {
        return false;
      }
      if (filterSet.engagement && filterSet.engagement !== "all") {
        const score = contact.engagement_score || 0;
        if (filterSet.engagement === "high" && score < 70) return false;
        if (filterSet.engagement === "medium" && (score < 40 || score >= 70)) return false;
        if (filterSet.engagement === "low" && score >= 40) return false;
      }
      if (filterSet.company && filterSet.company !== "all" && contact.company !== filterSet.company) {
        return false;
      }
      if (filterSet.suppressed && filterSet.suppressed !== "all") {
        if (filterSet.suppressed === "yes" && !contact.suppressed) return false;
        if (filterSet.suppressed === "no" && contact.suppressed) return false;
      }
      if (filterSet.searchQuery) {
        const query = filterSet.searchQuery.toLowerCase();
        const matchesSearch =
          contact.email.toLowerCase().includes(query) ||
          contact.first_name?.toLowerCase().includes(query) ||
          contact.last_name?.toLowerCase().includes(query) ||
          contact.company?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      return true;
    });
  };

  const handleImportSegment = async (segment: ListSegment) => {
    setLoadingSegment(segment.id);
    try {
      // Fetch all contacts
      const { data: allContacts, error } = await supabase
        .from("contacts")
        .select("id, email, first_name, last_name, company, status, engagement_score, suppressed");
      
      if (error) throw error;

      // Apply segment filters
      const filteredContacts = applyFilters(allContacts as Contact[], segment.filters);
      
      // Convert to recipients and filter out duplicates
      const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()));
      const newRecipients: Recipient[] = filteredContacts
        .filter(c => !existingEmails.has(c.email.toLowerCase()))
        .map(contact => ({
          email: contact.email,
          firstName: contact.first_name || undefined,
          lastName: contact.last_name || undefined,
          company: contact.company || undefined,
        }));

      if (newRecipients.length === 0) {
        toast({
          title: "No new contacts",
          description: "All contacts from this segment are already added",
        });
      } else {
        onRecipientsChange([...recipients, ...newRecipients]);
        toast({
          title: "Segment imported",
          description: `Added ${newRecipients.length} recipients from "${segment.name}"`,
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Could not import segment contacts",
        variant: "destructive",
      });
    } finally {
      setLoadingSegment(null);
    }
  };

  const getFilterSummary = (filterSet: SegmentFilters): string => {
    const parts: string[] = [];
    if (filterSet.status && filterSet.status !== "all") parts.push(`Status: ${filterSet.status}`);
    if (filterSet.engagement && filterSet.engagement !== "all") parts.push(`Engagement: ${filterSet.engagement}`);
    if (filterSet.company && filterSet.company !== "all") parts.push(`Company: ${filterSet.company}`);
    if (filterSet.suppressed && filterSet.suppressed !== "all") parts.push(`Suppressed: ${filterSet.suppressed}`);
    if (filterSet.searchQuery) parts.push(`Search: "${filterSet.searchQuery}"`);
    return parts.length > 0 ? parts.join(" • ") : "All contacts";
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const parseCSV = (text: string): Recipient[] => {
    const lines = text.trim().split("\n");
    if (lines.length === 0) return [];

    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const emailIndex = headers.findIndex((h) => h.includes("email"));
    const firstNameIndex = headers.findIndex((h) => h.includes("first") || h === "firstname");
    const lastNameIndex = headers.findIndex((h) => h.includes("last") || h === "lastname");
    const companyIndex = headers.findIndex((h) => h.includes("company") || h.includes("organization"));

    if (emailIndex === -1) {
      toast({
        title: "Invalid CSV",
        description: "CSV must contain an 'email' column",
        variant: "destructive",
      });
      return [];
    }

    const parsed: Recipient[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const email = values[emailIndex];
      if (email && email.includes("@")) {
        parsed.push({
          email,
          firstName: firstNameIndex !== -1 ? values[firstNameIndex] : undefined,
          lastName: lastNameIndex !== -1 ? values[lastNameIndex] : undefined,
          company: companyIndex !== -1 ? values[companyIndex] : undefined,
        });
      }
    }
    return parsed;
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        onRecipientsChange([...recipients, ...parsed]);
        toast({
          title: "Recipients imported",
          description: `Successfully imported ${parsed.length} recipients`,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleManualAdd = () => {
    const emails = manualEmails
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) {
      toast({
        title: "No valid emails",
        description: "Please enter valid email addresses",
        variant: "destructive",
      });
      return;
    }

    const newRecipients = emails.map((email) => ({ email }));
    onRecipientsChange([...recipients, ...newRecipients]);
    setManualEmails("");
    toast({
      title: "Recipients added",
      description: `Added ${emails.length} recipients`,
    });
  };

  const removeRecipient = (email: string) => {
    onRecipientsChange(recipients.filter((r) => r.email !== email));
  };

  const clearAll = () => {
    onRecipientsChange([]);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="w-4 h-4" />
            Upload CSV
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Users className="w-4 h-4" />
            Manual Entry
          </TabsTrigger>
          <TabsTrigger value="segments" className="gap-2">
            <ListFilter className="w-4 h-4" />
            Segments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">
              Drag and drop your CSV file here
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              or click to browse
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Select File
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              CSV should have columns: email (required), first_name, last_name, company
            </p>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Email Addresses</Label>
            <Textarea
              placeholder="Enter email addresses (one per line, or separated by commas)"
              value={manualEmails}
              onChange={(e) => setManualEmails(e.target.value)}
              className="min-h-[150px] bg-secondary/50"
            />
          </div>
          <Button type="button" onClick={handleManualAdd}>
            Add Recipients
          </Button>
        </TabsContent>

        <TabsContent value="segments" className="mt-4">
          {segmentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !segments || segments.length === 0 ? (
            <Card className="bg-secondary/30">
              <CardContent className="py-8 text-center">
                <ListFilter className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No saved segments</p>
                <p className="text-sm text-muted-foreground">
                  Create segments in the List Segmentation page to use them here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {segments.map((segment) => (
                <Card 
                  key={segment.id} 
                  className="bg-secondary/30 hover:border-primary/30 transition-all"
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{segment.name}</span>
                          <Badge variant="secondary" className="shrink-0">
                            {segment.contact_count} contacts
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {getFilterSummary(segment.filters)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleImportSegment(segment)}
                        disabled={loadingSegment === segment.id}
                        className="shrink-0 gap-2"
                      >
                        {loadingSegment === segment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        Import
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Recipients List */}
      {recipients.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="font-medium">{recipients.length} Recipients</span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              Clear All
            </Button>
          </div>

          <div className="bg-secondary/30 rounded-lg border border-border p-4 max-h-[300px] overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {recipients.slice(0, 50).map((recipient) => (
                <Badge
                  key={recipient.email}
                  variant="secondary"
                  className="flex items-center gap-1 py-1.5 px-3"
                >
                  {recipient.firstName || recipient.email}
                  <button
                    type="button"
                    onClick={() => removeRecipient(recipient.email)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {recipients.length > 50 && (
                <Badge variant="outline" className="py-1.5 px-3">
                  +{recipients.length - 50} more
                </Badge>
              )}
            </div>
          </div>

          {recipients.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>All recipients validated</span>
            </div>
          )}
        </div>
      )}

      {recipients.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4" />
          <span>No recipients added yet</span>
        </div>
      )}
    </div>
  );
};

export default RecipientSelector;
