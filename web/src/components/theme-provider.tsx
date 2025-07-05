// src/components/theme-provider.tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Derive the prop type from the real provider so it always stays correct.
 * This eliminates the bad `next-themes/dist/types` import that caused TS errors.
 */
type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

/**
 * Wraps `next-themes` so it can be imported from "@/components/theme-provider".
 *
 * Example usage in `app/layout.tsx`:
 * ```tsx
 * import ThemeProvider from "@/components/theme-provider";
 *
 * <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
 *   {children}
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export default ThemeProvider;
