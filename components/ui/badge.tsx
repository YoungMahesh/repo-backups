import React from "react";

export type BadgeVariant = "pill" | "coral" | "outline" | "success" | "warning" | "error";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "pill",
  className = "",
  children,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-sans font-medium select-none";

  const variantClasses: Record<BadgeVariant, string> = {
    pill: "bg-surface-card text-ink text-xs px-3 py-1 rounded-full border border-hairline/60",
    coral:
      "bg-primary text-on-primary text-[11px] uppercase tracking-wider px-3 py-1 rounded-full",
    outline:
      "bg-transparent text-muted border border-hairline text-xs px-2.5 py-0.5 rounded-full",
    success:
      "bg-success/15 text-success border border-success/30 text-xs px-2.5 py-0.5 rounded-full",
    warning:
      "bg-warning/15 text-warning border border-warning/30 text-xs px-2.5 py-0.5 rounded-full",
    error:
      "bg-error/15 text-error border border-error/30 text-xs px-2.5 py-0.5 rounded-full",
  };

  return (
    <span
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
