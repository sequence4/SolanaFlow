export const ALERT_TSX = /* tsx */ `
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const variantIcon = {
  info:  Info,
  warn:  AlertTriangle
} as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variantIcon;
}

export function Alert({ className, variant = "info", children, ...props }: AlertProps) {
  const Icon = variantIcon[variant];
  return (
    <div role="alert" className={cn("flex gap-2 rounded-md border p-4", className)} {...props}>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}

export const AlertDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("leading-relaxed", className)} {...p} />
);
`; 