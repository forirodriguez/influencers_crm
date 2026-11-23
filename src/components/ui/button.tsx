import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonStyles = cva(
  "inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-clay text-white hover:bg-clay-dark",
        secondary: "border border-line bg-card text-ink hover:bg-sand",
        ghost: "text-ink hover:bg-sand",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({
  className,
  variant,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button className={cn(buttonStyles({ variant }), className)} {...props} />;
}
