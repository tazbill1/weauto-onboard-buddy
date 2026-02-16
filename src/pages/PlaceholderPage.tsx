import { AppShell } from "@/components/AppShell";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center px-6 py-20 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          <span className="text-2xl">🚧</span>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          This section is under construction. Content will be available soon.
        </p>
      </div>
    </AppShell>
  );
}
