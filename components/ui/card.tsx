import React from "react";

export type CardVariant = "canvas" | "feature" | "dark" | "code-window";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  title?: string;
  subtitle?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "canvas",
      title,
      subtitle,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const variantClasses: Record<CardVariant, string> = {
      canvas: "bg-canvas border border-hairline text-ink rounded-lg p-6 sm:p-8",
      feature: "bg-surface-card text-ink rounded-lg p-6 sm:p-8 border border-hairline/60",
      dark: "bg-surface-dark text-on-dark rounded-lg p-6 sm:p-8 border border-surface-dark-elevated",
      "code-window":
        "bg-surface-dark text-on-dark rounded-lg border border-surface-dark-elevated overflow-hidden",
    };

    if (variant === "code-window") {
      return (
        <div
          ref={ref}
          className={`${variantClasses["code-window"]} ${className}`}
          {...props}
        >
          {/* Terminal / Code Window Chrome */}
          <div className="flex items-center justify-between border-b border-surface-dark-soft/80 bg-surface-dark-elevated px-4 py-2.5 text-xs text-on-dark-soft">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#c64545]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#d4a017]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#5db872]/70" />
              {title && (
                <span className="ml-2 font-mono text-xs text-on-dark-soft">
                  {title}
                </span>
              )}
            </div>
            {subtitle && (
              <span className="font-mono text-[11px] text-muted-soft">
                {subtitle}
              </span>
            )}
          </div>
          <div className="p-4 sm:p-6 font-mono text-xs text-on-dark overflow-x-auto bg-surface-dark-soft/60">
            {children}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={`${variantClasses[variant]} ${className}`}
        {...props}
      >
        {(title || subtitle) && (
          <div className="mb-4">
            {title && (
              <h3 className="font-serif text-xl font-normal tracking-tight text-inherit">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-muted-soft">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";
