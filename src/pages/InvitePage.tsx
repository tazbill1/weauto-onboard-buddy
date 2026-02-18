import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, RotateCw, XCircle, UserPlus, Copy, CheckCheck, Link as LinkIcon, UserCog } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const roleLabels: Record<string, string> = {
  associate: "Associate",
  sales_manager: "Sales Manager",
  gm: "General Manager",
  hr_admin: "HR Admin",
  corporate_admin: "Corporate Admin",
};

type AppRole = "associate" | "sales_manager" | "gm" | "hr_admin" | "corporate_admin";

function getAllowedRoles(myRole: AppRole): AppRole[] {
  switch (myRole) {
    case "sales_manager": return ["associate"];
    case "gm": return ["associate", "sales_manager"];
    case "hr_admin": return ["associate", "sales_manager"];
    case "corporate_admin": return ["associate", "sales_manager", "gm", "hr_admin"];
    default: return [];
  }
}

export default function InvitePage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Invite tab state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("associate");
  const [storeId, setStoreId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [autoStart, setAutoStart] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Add User tab state
  const [addEmail, setAddEmail] = useState("");
  const [addFullName, setAddFullName] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<AppRole>("associate");
  const [addStoreId, setAddStoreId] = useState("");
  const [addManagerId, setAddManagerId] = useState("");
  const [addAutoStart, setAddAutoStart] = useState(true);
  const [addLoading, setAddLoading] = useState(false);

  const myRole = profile?.role as AppRole;
  const allowedRoles = useMemo(() => getAllowedRoles(myRole), [myRole]);
  const isCorporateAdmin = myRole === "corporate_admin";

  useEffect(() => { document.title = "Invite — WEAuto"; }, []);

  useEffect(() => {
    if (!isCorporateAdmin && profile?.store_id) {
      setStoreId(profile.store_id);
      setAddStoreId(profile.store_id);
    }
  }, [profile, isCorporateAdmin]);

  useEffect(() => {
    if (myRole === "sales_manager" && profile?.user_id) {
      setManagerId(profile.user_id);
      setAddManagerId(profile.user_id);
    }
  }, [myRole, profile]);

  const { data: stores } = useQuery({
    queryKey: ["stores-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, store_name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: storeManagers } = useQuery({
    queryKey: ["store-managers", storeId],
    enabled: !!storeId && role === "associate",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, role")
        .eq("store_id", storeId)
        .eq("role", "sales_manager")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: addStoreManagers } = useQuery({
    queryKey: ["store-managers-add", addStoreId],
    enabled: !!addStoreId && addRole === "associate",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, role")
        .eq("store_id", addStoreId)
        .eq("role", "sales_manager")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ["invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites" as any)
        .select("*, stores!inner(store_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleSend = async () => {
    if (!email || !storeId) return;
    setSending(true);
    setLastInviteLink(null);
    setLinkCopied(false);
    try {
      const { data: existing } = await supabase
        .from("invites" as any)
        .select("id")
        .eq("email", email)
        .eq("store_id", storeId)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        toast({ title: "Invite already pending", description: "An invite for this email at this store is already pending.", variant: "destructive" });
        setSending(false);
        return;
      }

      const storeName = stores?.find(s => s.id === storeId)?.store_name || "your store";
      const { data: invite, error } = await supabase.from("invites" as any).insert({
        email, role, store_id: storeId, invited_by: profile?.user_id,
        assigned_manager_id: role === "associate" && managerId ? managerId : null,
        auto_start_onboarding: role === "associate" ? autoStart : false,
      } as any).select("token").single();

      if (error) throw error;
      const token = (invite as any).token;
      const inviteUrl = `${window.location.origin}/register?invite=${token}`;
      setLastInviteLink(inviteUrl);

      try {
        await supabase.functions.invoke("send-invite-email", {
          body: { to: email, inviterName: profile?.full_name || profile?.email || "A manager", role, storeName, token },
        });
      } catch { /* email failed silently */ }

      toast({ title: "Invite created!", description: `Share the link below with ${email}` });
      setEmail("");
      setRole("associate");
      setManagerId(myRole === "sales_manager" ? profile?.user_id || "" : "");
      if (isCorporateAdmin) setStoreId("");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleAddUser = async () => {
    if (!addEmail || !addPassword || !addStoreId) return;
    if (addPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setAddLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: addEmail,
          password: addPassword,
          role: addRole,
          storeId: addStoreId,
          fullName: addFullName,
          managerId: addRole === "associate" ? addManagerId : null,
          autoStart: addRole === "associate" ? addAutoStart : false,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "User created!",
        description: `${addEmail} has been added. They'll be prompted to set a new password on first login.`,
      });
      setAddEmail("");
      setAddFullName("");
      setAddPassword("");
      setAddRole("associate");
      setAddManagerId(myRole === "sales_manager" ? profile?.user_id || "" : "");
      if (isCorporateAdmin) setAddStoreId("");
    } catch (err: any) {
      toast({ title: "Error creating user", description: err.message, variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      const { error } = await supabase.from("invites" as any).update({ status: "revoked" } as any).eq("id", inviteId);
      if (error) throw error;
      toast({ title: "Invite revoked" });
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleResend = async (invite: any) => {
    try {
      await supabase.functions.invoke("send-invite-email", {
        body: { to: invite.email, inviterName: profile?.full_name || profile?.email || "A manager", role: invite.role, storeName: invite.stores?.store_name || "your store", token: invite.token },
      });
      toast({ title: "Invite resent!", description: `Email resent to ${invite.email}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pending" },
      accepted: { variant: "default", label: "Accepted" },
      expired: { variant: "secondary", label: "Expired" },
      revoked: { variant: "destructive", label: "Revoked" },
    };
    const c = config[status] || config.pending;
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  return (
    <AppShell>
      <div className="px-4 py-6 animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-6 w-6" /> Add Team Member
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create an account directly or send an invite link</p>
        </div>

        <Tabs defaultValue="add-user">
          <TabsList className="w-full">
            <TabsTrigger value="add-user" className="flex-1 gap-1.5">
              <UserCog className="h-3.5 w-3.5" /> Add Directly
            </TabsTrigger>
            <TabsTrigger value="invite" className="flex-1 gap-1.5">
              <Send className="h-3.5 w-3.5" /> Send Invite Link
            </TabsTrigger>
          </TabsList>

          {/* ── ADD USER TAB ── */}
          <TabsContent value="add-user" className="mt-4">
            <Card className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
                Creates the account immediately. The user will be required to set a new password on first login.
              </p>

              <div className="space-y-2">
                <Label htmlFor="add-full-name">Full Name</Label>
                <Input id="add-full-name" placeholder="Jane Smith" value={addFullName} onChange={(e) => setAddFullName(e.target.value)} className="h-12" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-email">Email Address</Label>
                <Input id="add-email" type="email" placeholder="jane@weauto.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} className="h-12" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-password">Temporary Password</Label>
                <Input id="add-password" type="password" placeholder="Min 6 characters" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} className="h-12" minLength={6} required />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={addRole} onValueChange={(v) => setAddRole(v as AppRole)}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {isCorporateAdmin && (
                <div className="space-y-2">
                  <Label>Store</Label>
                  <Select value={addStoreId} onValueChange={setAddStoreId}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Select a store" /></SelectTrigger>
                    <SelectContent>
                      {stores?.map((s) => <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {addRole === "associate" && myRole !== "sales_manager" && (
                <div className="space-y-2">
                  <Label>Assigned Manager</Label>
                  <Select value={addManagerId} onValueChange={setAddManagerId}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Select a manager" /></SelectTrigger>
                    <SelectContent>
                      {addStoreManagers?.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>)}
                      {(!addStoreManagers || addStoreManagers.length === 0) && <SelectItem value="none" disabled>No managers at this store</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {addRole === "associate" && (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="text-sm">Auto-start onboarding</Label>
                    <p className="text-xs text-muted-foreground">Automatically create their onboarding program</p>
                  </div>
                  <Switch checked={addAutoStart} onCheckedChange={setAddAutoStart} />
                </div>
              )}

              <Button className="w-full h-12 gap-2 text-base font-semibold" disabled={addLoading || !addEmail || !addPassword || !addStoreId} onClick={handleAddUser}>
                <UserCog className="h-4 w-4" />
                {addLoading ? "Creating account…" : "Create Account"}
              </Button>
            </Card>
          </TabsContent>

          {/* ── INVITE LINK TAB ── */}
          <TabsContent value="invite" className="mt-4 space-y-4">
            <Card className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input id="invite-email" type="email" placeholder="newteammember@weauto.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" required />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {isCorporateAdmin && (
                <div className="space-y-2">
                  <Label>Store</Label>
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Select a store" /></SelectTrigger>
                    <SelectContent>
                      {stores?.map((s) => <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {role === "associate" && myRole !== "sales_manager" && (
                <div className="space-y-2">
                  <Label>Assigned Manager</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Select a manager" /></SelectTrigger>
                    <SelectContent>
                      {storeManagers?.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>)}
                      {(!storeManagers || storeManagers.length === 0) && <SelectItem value="none" disabled>No managers at this store</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {role === "associate" && (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="text-sm">Auto-start onboarding on registration</Label>
                    <p className="text-xs text-muted-foreground">Automatically create their onboarding program</p>
                  </div>
                  <Switch checked={autoStart} onCheckedChange={setAutoStart} />
                </div>
              )}

              <Button className="w-full h-12 gap-2 text-base font-semibold" disabled={sending || !email || !storeId} onClick={handleSend}>
                <Send className="h-4 w-4" />
                {sending ? "Sending…" : "Send Invite"}
              </Button>

              {lastInviteLink && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" /> Invite Link (share manually if email didn't arrive)
                  </p>
                  <div className="flex gap-2">
                    <Input value={lastInviteLink} readOnly className="text-xs h-9 font-mono" />
                    <Button variant="outline" size="sm" className="h-9 gap-1 shrink-0"
                      onClick={() => { navigator.clipboard.writeText(lastInviteLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}>
                      {linkCopied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {linkCopied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <div>
              <h2 className="text-base font-bold text-foreground mb-2">Invite History</h2>
              {invitesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : !invites?.length ? (
                <Card className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No invites sent yet</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {invites.map((inv: any) => (
                    <Card key={inv.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">{roleLabels[inv.role] || inv.role} · {inv.stores?.store_name || ""}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">{statusBadge(inv.status)}</div>
                      </div>
                      {inv.status === "pending" && (
                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" className="flex-1 gap-1"
                            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register?invite=${inv.token}`); toast({ title: "Link copied!" }); }}>
                            <Copy className="h-3.5 w-3.5" /> Copy Link
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => handleResend(inv)}>
                            <RotateCw className="h-3.5 w-3.5" /> Resend
                          </Button>
                          <ConfirmDialog
                            title="Revoke Invite?"
                            description={`This will cancel the invite to ${inv.email}. They won't be able to register with this link.`}
                            confirmLabel="Revoke"
                            confirmVariant="destructive"
                            onConfirm={() => handleRevoke(inv.id)}
                            trigger={
                              <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive/20 hover:bg-destructive/5">
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
