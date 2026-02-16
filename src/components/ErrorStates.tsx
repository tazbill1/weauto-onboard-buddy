import { AlertTriangle, RefreshCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-8 text-center">
      <WifiOff className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground">Connection lost</p>
      <p className="text-xs text-muted-foreground mt-1">Please check your internet and try again.</p>
      <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={onRetry}>
        <RefreshCcw className="h-4 w-4" /> Retry
      </Button>
    </Card>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-warning/60 mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground">Something went wrong</p>
      <p className="text-xs text-muted-foreground mt-1">Pull down to refresh or tap retry.</p>
      <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={onRetry}>
        <RefreshCcw className="h-4 w-4" /> Retry
      </Button>
    </Card>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <Card className="p-8 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </Card>
  );
}
