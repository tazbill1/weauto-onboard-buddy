import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WEAutoLogo } from "@/components/WEAutoLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

const roleLabels: Record<string, string> = {
  associate: "Associate",
  sales_manager: "Sales Manager",
  gm: "General Manager",
  hr_admin: "HR Admin",
  corporate_admin: "Corporate Admin",
};

interface InviteData {
  email: string;
  role: string;
  store_id: string;
  status: string;
  auto_start_onboarding: boolean;
  assigned_manager_id: string | null;
  store_name: string | null;
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    fetch(`https://${projectId}.supabase.co/functions/v1/get-invite-by-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: inviteToken }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.error) {
          setInviteStatus("invalid");
          return;
        }
        if (data.status === "accepted") {
          setInviteStatus("accepted");
        } else if (data.status === "expired") {
          setInviteStatus("expired");
        } else if (data.status === "valid") {
          setInvite({
            email: data.email,
            role: data.role,
            store_id: data.store_id,
            status: "pending",
            auto_start_onboarding: data.auto_start_onboarding,
            assigned_manager_id: data.assigned_manager_id,
            store_name: data.store_name,
          });
          setEmail(data.email);
          setInviteStatus("valid");
        } else {
          setInviteStatus("invalid");
        }
      })
      .catch(() => setInviteStatus("invalid"));
  }, [inviteToken]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return; // should never reach this without a valid invite
    setLoading(true);

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          role: invite.role,
          store_id: invite.store_id || null,
        },
      },
    });

    if (error) {
      setLoading(false);
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
      return;
    }

    // Update invite to accepted
    await supabase
      .from("invites" as any)
      .update({ status: "accepted", accepted_at: new Date().toISOString() } as any)
      .eq("token", inviteToken);

    // Auto-create onboarding program if applicable
    if (authData.user && invite.auto_start_onboarding && invite.role === "associate" && invite.assigned_manager_id) {
      await supabase.from("onboarding_programs" as any).insert({
        associate_id: authData.user.id,
        manager_id: invite.assigned_manager_id,
        store_id: invite.store_id,
        start_date: format(new Date(), "yyyy-MM-dd"),
        status: "active",
        current_day: 1,
      } as any);
    }

    setLoading(false);
    toast({ title: "Welcome to WEAuto!", description: "Your account has been created. Please check your email to verify." });
    navigate("/login");
  };

  // Loading invite
  if (inviteStatus === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <WEAutoLogo className="scale-125 mb-6" />
        <p className="text-muted-foreground">Loading invite…</p>
      </div>
    );
  }

  // No invite token — block open registration
  if (inviteStatus === "none") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center animate-fade-in">
          <WEAutoLogo className="scale-125 mx-auto mb-8" />
          <div className="rounded-xl border bg-muted/50 p-6 mb-6">
            <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h1 className="text-xl font-bold text-foreground mb-2">Invite Required</h1>
            <p className="text-sm text-muted-foreground">
              WEAuto is only available to dealership employees. Account creation requires a valid invite link from your manager or HR.
            </p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="w-full h-12">Back to Sign In</Button>
          </Link>
        </div>
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
          <p className="text-sm text-muted-foreground mb-6">This invite has already been accepted. Sign in if you already have an account.</p>
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
          <p className="text-sm text-muted-foreground mb-6">This invite link is not valid. Please contact your manager.</p>
          <Link to="/login">
            <Button variant="outline" className="w-full">Go to Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Only reached when inviteStatus === "valid"
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex justify-center">
          <WEAutoLogo className="scale-125" />
        </div>

        {invite && (
          <div className="mb-6 rounded-xl border bg-primary/5 border-primary/20 p-4">
            <p className="text-sm font-medium text-foreground">
              You've been invited to join <strong>{invite.store_name}</strong> as a{" "}
              <strong>{roleLabels[invite.role]}</strong>
            </p>
          </div>
        )}

        <h1 className="mb-1 text-2xl font-bold text-foreground">Create account</h1>
        <p className="mb-6 text-sm text-muted-foreground">Complete your registration below</p>

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
              readOnly
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regPassword">Password</Label>
            <Input id="regPassword" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-12" />
          </div>
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
