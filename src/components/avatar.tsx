import { avatarColor, cn, initial } from "@/lib/utils";

export function Avatar({
  name,
  color,
  size = 28,
  className,
}: {
  name: string;
  color: number;
  size?: number;
  className?: string;
}) {
  const c = avatarColor(color);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-extrabold", className)}
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size >= 40 ? size * 0.42 : 12 }}
    >
      {initial(name)}
    </span>
  );
}
