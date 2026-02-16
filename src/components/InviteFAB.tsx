import { useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";

export function InviteFAB() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/invite")}
      className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95"
      aria-label="Invite team member"
    >
      <UserPlus className="h-6 w-6" />
    </button>
  );
}
