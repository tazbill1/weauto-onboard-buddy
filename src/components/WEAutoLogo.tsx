import weautoLogo from "@/assets/weauto-logo.jpeg";

export function WEAutoLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={weautoLogo} alt="WEAuto logo" className="h-9 w-9 object-contain" />
      <div className="flex flex-col leading-none">
        <span className="text-base font-bold text-foreground tracking-tight">WEAuto</span>
        <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">Onboarding</span>
      </div>
    </div>
  );
}
