import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combines clsx() with tailwind-merge so last-one-wins for Tailwind classes. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
} 