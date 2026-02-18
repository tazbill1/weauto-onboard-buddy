import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { WEAutoLogo } from "@/components/WEAutoLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Update the password
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      toast({ title: "Error", description: pwError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Clear the must_change_password flag
    if (profile?.user_id) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false } as any)
        .eq("user_id", profile.user_id);
    }

    toast({ title: "Password updated!", description: "Welcome to WEAuto Onboarding." });
    setLoading(false);
    navigate("/");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex justify-center">
          <WEAutoLogo className="scale-125" />
        </div>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set your password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your account was created by an admin. Please set a personal password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-12"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="h-12"
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
            {loading ? "Saving…" : "Set Password & Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
