const DEPT_COLORS: Record<string, string> = {
  sales: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  service_advisor: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  bdc: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  finance: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  parts: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  detailing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  custom: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
};

function getColorForSlug(slug?: string): string {
  if (!slug) return DEPT_COLORS.custom;
  return DEPT_COLORS[slug] || DEPT_COLORS.custom;
}

interface DepartmentBadgeProps {
  label: string;
  slug?: string;
}

export function DepartmentBadge({ label, slug }: DepartmentBadgeProps) {
  const colorClass = getColorForSlug(slug);
  return (
    <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${colorClass}`}>
      {label}
    </span>
  );
}
