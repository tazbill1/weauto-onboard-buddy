import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WEAutoLogo } from "@/components/WEAutoLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

const roles = [
  { value: "associate", label: "Associate" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "gm", label: "General Manager" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "corporate_admin", label: "Corporate Admin" },
];

const roleLabels: Record<string, string> = {
  associate: "Associate",
  sales_manager: "Sales Manager",
  gm: "General Manager",
  hr_admin: "HR Admin",
  corporate_admin: "Corporate Admin",
};

interface Store {
  id: string;
  store_name: string;
}

interface InviteData {
  id: string;
  email: string;
  role: string;
  store_id: string;
  status: string;
  token: string;
  auto_start_onboarding: boolean;
  assigned_manager_id: string | null;
  expires_at: string;
  stores: { store_name: string };
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("associate");
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Invite state
  const inviteToken = searchParams.get("invite");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [inviteStatus, setInviteStatus] = useState<"loading" | "valid" | "expired" | "accepted" | "invalid" | "none">(
    inviteToken ? "loading" : "none"
  );

  // Fetch invite if token present
  useEffect(() => {
    if (!inviteToken) return;
    supabase
      .from("invites" as any)
      .select("*, stores!inner(store_name)")
      .eq("token", inviteToken)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setInviteStatus("invalid");
          return;
        }
        const inv = data as any as InviteData;
        if (inv.status === "accepted") {
          setInviteStatus("accepted");
        } else if (inv.status === "revoked") {
          setInviteStatus("invalid");
        } else if (inv.status === "expired" || new Date(inv.expires_at) < new Date()) {
          setInviteStatus("expired");
        } else if (inv.status === "pending") {
          setInvite(inv);
          setEmail(inv.email);
          setRole(inv.role);
          setStoreId(inv.store_id);
          setInviteStatus("valid");
        } else {
          setInviteStatus("invalid");
        }
      });
  }, [inviteToken]);

  useEffect(() => {
    supabase.from("stores").select("id, store_name").eq("is_active", true).then(({ data }) => {
      if (data) setStores(data);
    });
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const signUpRole = invite ? invite.role : role;
    const signUpStoreId = invite ? invite.store_id : storeId;

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          role: signUpRole,
          store_id: signUpStoreId || null,
        },
      },
    });
    
    if (error) {
      setLoading(false);
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
      return;
    }

    // If invite, update invite status and optionally create onboarding program
    if (invite && authData.user) {
      // Update invite to accepted
      await supabase
        .from("invites" as any)
        .update({ status: "accepted", accepted_at: new Date().toISOString() } as any)
        .eq("id", invite.id);

      // Auto-create onboarding program if applicable
      if (invite.auto_start_onboarding && invite.role === "associate" && invite.assigned_manager_id) {
        await supabase.from("onboarding_programs" as any).insert({
          associate_id: authData.user.id,
          manager_id: invite.assigned_manager_id,
          store_id: invite.store_id,
          start_date: format(new Date(), "yyyy-MM-dd"),
          status: "active",
          current_day: 1,
        } as any);
      }
    }

    setLoading(false);

    if (invite) {
      toast({ title: "Welcome to WEAuto!", description: "Your account has been created." });
      navigate("/");
    } else {
      toast({ title: "Account created!", description: "You can now sign in." });
      navigate("/login");
    }
  };

  // Invite error states
  if (inviteStatus === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <WEAutoLogo className="scale-125 mb-6" />
        <p className="text-muted-foreground">Loading invite…</p>
      </div>
    );
  }

  if (inviteStatus === "expired") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          <WEAutoLogo className="scale-125 mx-auto mb-6" />
          <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Invite Expired</h1>
          <p className="text-sm text-muted-foreground mb-6">This invite has expired. Please ask your manager to send a new one.</p>
          <Link to="/login">
            <Button variant="outline" className="w-full">Go to Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (inviteStatus === "accepted") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          <WEAutoLogo className="scale-125 mx-auto mb-6" />
          <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Invite Already Used</h1>
          <p className="text-sm text-muted-foreground mb-6">This invite has already been accepted.</p>
          <Link to="/login">
            <Button variant="outline" className="w-full">Go to Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (inviteStatus === "invalid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          <WEAutoLogo className="scale-125 mx-auto mb-6" />
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Invalid Invite</h1>
          <p className="text-sm text-muted-foreground mb-6">This invite link is not valid.</p>
          <Link to="/login">
            <Button variant="outline" className="w-full">Go to Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex justify-center">
          <WEAutoLogo className="scale-125" />
        </div>

        {invite && (
          <div className="mb-6 rounded-xl border bg-primary/5 border-primary/20 p-4">
            <p className="text-sm font-medium text-foreground">
              You've been invited to join <strong>{invite.stores.store_name}</strong> as a{" "}
              <strong>{roleLabels[invite.role]}</strong>
            </p>
          </div>
        )}

        <h1 className="mb-1 text-2xl font-bold text-foreground">Create account</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {invite ? "Complete your registration below" : "Join the WEAuto onboarding program"}
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regEmail">Email</Label>
            <Input
              id="regEmail"
              type="email"
              placeholder="you@weauto.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12"
              readOnly={!!invite}
              disabled={!!invite}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regPassword">Password</Label>
            <Input id="regPassword" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-12" />
          </div>
          {!invite && (
            <div className="space-y-2">
              <Label>Store</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select a store" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
            {loading ? "Creating…" : "Create Account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
