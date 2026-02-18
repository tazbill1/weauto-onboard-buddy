import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Search, UserCheck, UserX, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

const roleLabels: Record<string, string> = {
  associate: "Associate",
  sales_manager: "Sales Manager",
  gm: "General Manager",
  hr_admin: "HR Admin",
  corporate_admin: "Corporate Admin",
};

const roleColors: Record<string, string> = {
  associate: "secondary",
  sales_manager: "default",
  gm: "default",
  hr_admin: "outline",
  corporate_admin: "outline",
};

export default function UsersPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");

  useEffect(() => { document.title = "Users — WEAuto"; }, []);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ userId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const isCorporateAdmin = profile?.role === "corporate_admin";
  const isHRAdmin = profile?.role === "hr_admin";
  const isGM = profile?.role === "gm";

  const { data: stores } = useQuery({
    queryKey: ["stores-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, store_name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users", profile?.store_id],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("user_id, full_name, email, role, store_id, is_active, created_at, hired_date")
        .order("full_name", { ascending: true });

      // Scope to store for non-corporate admins
      if (!isCorporateAdmin && profile?.store_id) {
        query = query.eq("store_id", profile.store_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const storeMap = useMemo(() => {
    const map: Record<string, string> = {};
    stores?.forEach((s) => { map[s.id] = s.store_name; });
    return map;
  }, [stores]);

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.is_active) ||
        (statusFilter === "inactive" && !u.is_active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !currentlyActive })
        .eq("user_id", userId);
      if (error) throw error;
      toast({ title: currentlyActive ? "User deactivated" : "User activated" });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openResetDialog = (userId: string, name: string) => {
    setResetTarget({ userId, name });
    setNewPassword("");
    setResetDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 6) return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { userId: resetTarget.userId, password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Password reset!", description: `Password updated for ${resetTarget.name}.` });
      setResetDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const availableRoles = isCorporateAdmin
    ? Object.keys(roleLabels)
    : isGM
    ? ["associate", "sales_manager", "gm"]
    : ["associate", "sales_manager"];

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6" /> Users
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} {filtered.length === 1 ? "user" : "users"}
              {!isCorporateAdmin && profile?.store_id && storeMap[profile.store_id]
                ? ` at ${storeMap[profile.store_id]}`
                : ""}
            </p>
          </div>
          <Button size="sm" onClick={() => navigate("/invite")} className="gap-1.5">
            + Add User
          </Button>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 flex-1">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <Card key={u.user_id} className={`p-4 ${!u.is_active ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {u.full_name || "(No name)"}
                      </p>
                      <Badge variant={roleColors[u.role] as any} className="text-[10px] px-1.5 py-0">
                        {roleLabels[u.role] || u.role}
                      </Badge>
                      {!u.is_active && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                    {isCorporateAdmin && u.store_id && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {storeMap[u.store_id] || "Unknown store"}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                      title="Reset password"
                      onClick={() => openResetDialog(u.user_id, u.full_name || u.email)}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      title={u.is_active ? "Deactivate User?" : "Activate User?"}
                      description={
                        u.is_active
                          ? `${u.full_name || u.email} will no longer be able to access the app.`
                          : `${u.full_name || u.email} will regain access to the app.`
                      }
                      confirmLabel={u.is_active ? "Deactivate" : "Activate"}
                      confirmVariant={u.is_active ? "destructive" : "default"}
                      onConfirm={() => handleToggleActive(u.user_id, u.is_active)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 ${u.is_active ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-primary"}`}
                        >
                          {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                      }
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Reset Password Dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Set a new password for <strong>{resetTarget?.name}</strong>.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11"
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6}>
                {resetting ? "Saving…" : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

