import React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "secondary-on-dark"
  | "text-link"
  | "icon-circular";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      isLoading = false,
      disabled = false,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center font-sans text-sm font-medium transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed";

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        "h-10 px-5 rounded-md bg-primary text-on-primary hover:bg-primary-active active:bg-primary-active focus-visible:outline-primary disabled:bg-primary-disabled disabled:text-muted",
      secondary:
        "h-10 px-5 rounded-md bg-canvas text-ink border border-hairline hover:bg-surface-soft active:bg-surface-card focus-visible:outline-primary disabled:opacity-50",
      "secondary-on-dark":
        "h-10 px-5 rounded-md bg-surface-dark-elevated text-on-dark border border-surface-dark-soft hover:bg-surface-dark-soft focus-visible:outline-primary disabled:opacity-50",
      "text-link":
        "bg-transparent text-ink hover:text-primary active:text-primary-active p-0 h-auto underline-offset-4 hover:underline disabled:opacity-50",
      "icon-circular":
        "h-9 w-9 rounded-full bg-canvas text-ink border border-hairline hover:bg-surface-soft active:bg-surface-card disabled:opacity-50",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin text-current"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
