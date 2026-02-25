import { Badge } from "@/components/ui/badge";

interface DepartmentBadgeProps {
  label: string;
}

export function DepartmentBadge({ label }: DepartmentBadgeProps) {
  return (
    <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 h-4 border-muted-foreground/30 text-muted-foreground">
      {label}
    </Badge>
  );
}
