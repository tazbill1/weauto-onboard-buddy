import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil, Search, MapPin } from "lucide-react";
import { isAdmin } from "@/lib/roles";

interface StoreForm {
  store_name: string;
  brand: string;
  address: string;
}

const emptyForm: StoreForm = { store_name: "", brand: "", address: "" };

export default function LocationsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StoreForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = "Locations — WEAuto"; }, []);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["all-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("store_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filtered = stores?.filter((s) =>
    !search ||
    s.store_name.toLowerCase().includes(search.toLowerCase()) ||
    s.brand.toLowerCase().includes(search.toLowerCase()) ||
    s.address?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (store: typeof filtered[0]) => {
    setEditingId(store.id);
    setForm({ store_name: store.store_name, brand: store.brand, address: store.address || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.store_name.trim() || !form.brand.trim()) {
      toast({ title: "Name and brand are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("stores")
          .update({ store_name: form.store_name.trim(), brand: form.brand.trim(), address: form.address.trim() || null })
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Location updated" });
      } else {
        const { error } = await supabase
          .from("stores")
          .insert({ store_name: form.store_name.trim(), brand: form.brand.trim(), address: form.address.trim() || null });
        if (error) throw error;
        toast({ title: "Location added" });
      }
      queryClient.invalidateQueries({ queryKey: ["all-stores"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    try {
      const { error } = await supabase
        .from("stores")
        .update({ is_active: !currentlyActive })
        .eq("id", id);
      if (error) throw error;
      toast({ title: currentlyActive ? "Location deactivated" : "Location activated" });
      queryClient.invalidateQueries({ queryKey: ["all-stores"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6" /> Locations
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} {filtered.length === 1 ? "location" : "locations"}
            </p>
          </div>
          {isAdmin(profile?.role) && (
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Location
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search locations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No locations found</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <Card key={s.id} className={`p-4 ${!s.is_active ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{s.store_name}</p>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{s.brand}</Badge>
                      {!s.is_active && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Inactive</Badge>
                      )}
                    </div>
                    {s.address && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {s.address}
                      </p>
                    )}
                  </div>
                  {isAdmin(profile?.role) && (
                    <div className="flex-shrink-0 flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                        title="Edit"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        title={s.is_active ? "Deactivate Location?" : "Activate Location?"}
                        description={
                          s.is_active
                            ? `"${s.store_name}" will be hidden from new invites and assignments.`
                            : `"${s.store_name}" will be available again for invites and assignments.`
                        }
                        confirmLabel={s.is_active ? "Deactivate" : "Activate"}
                        confirmVariant={s.is_active ? "destructive" : "default"}
                        onConfirm={() => handleToggleActive(s.id, s.is_active)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 ${s.is_active ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-primary"}`}
                          >
                            <Building2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Location" : "Add Location"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="store-name">Store Name *</Label>
                <Input
                  id="store-name"
                  placeholder="e.g. Downtown Store"
                  value={form.store_name}
                  onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand">Brand *</Label>
                <Input
                  id="brand"
                  placeholder="e.g. WEAuto"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Optional"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.store_name.trim() || !form.brand.trim()}>
                {saving ? "Saving…" : editingId ? "Update" : "Add Location"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
