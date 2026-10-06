import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AVATAR_COLORS = [
  { bg: "#dcfce7", fg: "#166534" },
  { bg: "#e5eef9", fg: "#2c5d93" },
  { bg: "#f8ecdd", fg: "#94560f" },
  { bg: "#f0e7f7", fg: "#6a3a8e" },
  { bg: "#fde4e4", fg: "#9b2c2c" },
  { bg: "#d9f2f1", fg: "#1d6b68" },
  { bg: "#fdf3c7", fg: "#7a5a00" },
  { bg: "#e6e8fb", fg: "#3b3f9e" },
] as const;

export function avatarColor(index: number) {
  return AVATAR_COLORS[((index % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length];
}

export function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function parseNames(input: string): string[] {
  return input
    .split(/[,\n;&]|\s+and\s+|\s+dan\s+/i)
    .map((s) => s.trim().replace(/\s+/g, " ").slice(0, 30))
    .filter(Boolean);
}

export function newId(length = 8) {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
