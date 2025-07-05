export const CARD_TSX = /* tsx */ `
import { VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-xl border bg-background text-card-foreground shadow", {
  variants: {
    variant: {
      default: "border-border",
      subtle: "border-muted bg-muted"
    }
  },
  defaultVariants: { variant: "default" }
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = ({ className, variant, ...props }: CardProps) => (
  <div className={cn(cardVariants({ variant }), className)} {...props} />
);

export const CardHeader   = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...p} />
);
export const CardTitle    = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...p} />
);
export const CardContent  = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...p} />
);
`; 