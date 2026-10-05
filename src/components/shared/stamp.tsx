import { cn } from "@/lib/utils";

export function Stamp({ children, className, rotate = -8 }: { children: string; className?: string; rotate?: number }) {
  return (
    <span
      className={cn("inline-block border-[2.5px] border-stamp px-1.5 font-mono text-[14px] font-bold tracking-[0.12em] text-stamp", className)}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}
