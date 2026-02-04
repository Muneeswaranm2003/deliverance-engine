import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Users,
  Filter,
  Save,
  Trash2,
  Search,
  Loader2,
  ListFilter,
  Eye,
  X,
  Pencil,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts">;

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

const ListSegmentation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<ListSegment | null>(null);
  const [editingSegment, setEditingSegment] = useState<ListSegment | null>(null);
  
  // Filter state for creating/editing segment
  const [filters, setFilters] = useState<SegmentFilters>({});
  const [segmentName, setSegmentName] = useState("");
  const [segmentDescription, setSegmentDescription] = useState("");

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

  // Fetch all contacts for filtering
  const { data: allContacts } = useQuery({
    queryKey: ["all-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contact[];
    },
  });

  // Get unique companies for filter dropdown
  const companies = [...new Set(allContacts?.map((c) => c.company).filter(Boolean) || [])];

  // Apply filters to contacts
  const applyFilters = (contacts: Contact[] | undefined, filterSet: SegmentFilters): Contact[] => {
    if (!contacts) return [];
    
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

  const filteredContacts = applyFilters(allContacts, filters);
  const previewContacts = selectedSegment 
    ? applyFilters(allContacts, selectedSegment.filters as SegmentFilters)
    : [];

  // Create segment mutation
  const createSegment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!segmentName.trim()) throw new Error("Segment name is required");

      const { error } = await supabase.from("list_segments").insert([{
        user_id: user.id,
        name: segmentName.trim(),
        description: segmentDescription.trim() || null,
        filters: JSON.parse(JSON.stringify(filters)),
        contact_count: filteredContacts.length,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-segments"] });
      toast.success("Segment created successfully");
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create segment");
    },
  });

  // Update segment mutation
  const updateSegment = useMutation({
    mutationFn: async () => {
      if (!editingSegment) throw new Error("No segment selected");
      if (!segmentName.trim()) throw new Error("Segment name is required");

      const { error } = await supabase
        .from("list_segments")
        .update({
          name: segmentName.trim(),
          description: segmentDescription.trim() || null,
          filters: JSON.parse(JSON.stringify(filters)),
          contact_count: filteredContacts.length,
        })
        .eq("id", editingSegment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-segments"] });
      toast.success("Segment updated successfully");
      setIsEditOpen(false);
      setEditingSegment(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update segment");
    },
  });

  // Delete segment mutation
  const deleteSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_segments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-segments"] });
      toast.success("Segment deleted");
    },
    onError: () => {
      toast.error("Failed to delete segment");
    },
  });

  const resetForm = () => {
    setFilters({});
    setSegmentName("");
    setSegmentDescription("");
  };

  const openEditDialog = (segment: ListSegment) => {
    setEditingSegment(segment);
    setSegmentName(segment.name);
    setSegmentDescription(segment.description || "");
    setFilters(segment.filters);
    setIsEditOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditOpen(false);
    setEditingSegment(null);
    resetForm();
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

  return (
    <AppLayout
      title="List Segmentation"
      description="Create and manage contact segments for targeted campaigns"
      action={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Segment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Segment</DialogTitle>
              <DialogDescription>
                Filter your contacts and save as a reusable segment
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Segment Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Segment Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., High Engagement Users"
                    value={segmentName}
                    onChange={(e) => setSegmentName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe this segment..."
                    value={segmentDescription}
                    onChange={(e) => setSegmentDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter Criteria
                </h4>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={filters.status || "all"}
                      onValueChange={(v) => setFilters({ ...filters, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Engagement Level</Label>
                    <Select
                      value={filters.engagement || "all"}
                      onValueChange={(v) => setFilters({ ...filters, engagement: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="high">High (70+)</SelectItem>
                        <SelectItem value="medium">Medium (40-69)</SelectItem>
                        <SelectItem value="low">Low (&lt;40)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Company</Label>
                    <Select
                      value={filters.company || "all"}
                      onValueChange={(v) => setFilters({ ...filters, company: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All companies" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Companies</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company} value={company!}>
                            {company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Suppressed</Label>
                    <Select
                      value={filters.suppressed || "all"}
                      onValueChange={(v) => setFilters({ ...filters, suppressed: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="no">Not Suppressed</SelectItem>
                        <SelectItem value="yes">Suppressed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email, name, or company..."
                      value={filters.searchQuery || ""}
                      onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <Card className="bg-secondary/30">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      <span className="font-medium">
                        {filteredContacts.length} contacts match
                      </span>
                    </div>
                    <Badge variant="secondary">{getFilterSummary(filters)}</Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createSegment.mutate()}
                  disabled={!segmentName.trim() || createSegment.isPending}
                  className="gap-2"
                >
                  {createSegment.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Segment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Saved Segments */}
      {segmentsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !segments || segments.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <ListFilter className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold mb-2">No segments yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first segment to organize contacts for targeted campaigns
            </p>
            <Button variant="hero" onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Segment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {segments.map((segment, index) => (
            <motion.div
              key={segment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="glass hover:border-primary/30 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{segment.name}</CardTitle>
                      {segment.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {segment.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(segment)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteSegment.mutate(segment.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-display text-2xl font-bold">
                        {segment.contact_count}
                      </span>
                      <span className="text-sm text-muted-foreground">contacts</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {Object.entries(segment.filters as SegmentFilters).map(([key, value]) => {
                        if (!value || value === "all") return null;
                        return (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}: {value}
                          </Badge>
                        );
                      })}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Created {format(new Date(segment.created_at), "MMM d, yyyy")}
                    </p>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => {
                        setSelectedSegment(segment);
                        setIsPreviewOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      View Contacts
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Segment</DialogTitle>
            <DialogDescription>
              Update segment filters and settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Segment Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Segment Name *</Label>
                <Input
                  id="edit-name"
                  placeholder="e.g., High Engagement Users"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Describe this segment..."
                  value={segmentDescription}
                  onChange={(e) => setSegmentDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter Criteria
              </h4>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={filters.status || "all"}
                    onValueChange={(v) => setFilters({ ...filters, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="churned">Churned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Engagement Level</Label>
                  <Select
                    value={filters.engagement || "all"}
                    onValueChange={(v) => setFilters({ ...filters, engagement: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="high">High (70+)</SelectItem>
                      <SelectItem value="medium">Medium (40-69)</SelectItem>
                      <SelectItem value="low">Low (&lt;40)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Company</Label>
                  <Select
                    value={filters.company || "all"}
                    onValueChange={(v) => setFilters({ ...filters, company: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All companies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company} value={company!}>
                          {company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Suppressed</Label>
                  <Select
                    value={filters.suppressed || "all"}
                    onValueChange={(v) => setFilters({ ...filters, suppressed: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="no">Not Suppressed</SelectItem>
                      <SelectItem value="yes">Suppressed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email, name, or company..."
                    value={filters.searchQuery || ""}
                    onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <Card className="bg-secondary/30">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <span className="font-medium">
                      {filteredContacts.length} contacts match
                    </span>
                  </div>
                  <Badge variant="secondary">{getFilterSummary(filters)}</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeEditDialog}>
                Cancel
              </Button>
              <Button
                onClick={() => updateSegment.mutate()}
                disabled={!segmentName.trim() || updateSegment.isPending}
                className="gap-2"
              >
                {updateSegment.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedSegment?.name}
            </DialogTitle>
            <DialogDescription>
              {previewContacts.length} contacts in this segment
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {previewContacts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No contacts match this segment's criteria
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Engagement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewContacts.slice(0, 100).map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.email}</TableCell>
                      <TableCell>
                        {contact.first_name || contact.last_name
                          ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
                          : "—"}
                      </TableCell>
                      <TableCell>{contact.company || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{contact.status || "active"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            (contact.engagement_score || 0) >= 70
                              ? "bg-emerald-500/10 text-emerald-500"
                              : (contact.engagement_score || 0) >= 40
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-destructive/10 text-destructive"
                          }
                        >
                          {contact.engagement_score || 0}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {previewContacts.length > 100 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Showing first 100 of {previewContacts.length} contacts
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ListSegmentation;
