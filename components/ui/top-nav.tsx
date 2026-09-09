import React from "react";
import { Badge } from "./badge";

export interface TopNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
  onSignOut?: () => void;
  isSigningOut?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  user,
  onSignOut,
  isSigningOut = false,
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-hairline bg-canvas/95 px-4 sm:px-8 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        {/* Anthropic 4-Spoke Radial Mark */}
        <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-surface-card text-ink">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-ink"
            aria-hidden="true"
          >
            <line x1="12" y1="2" x2="12" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-serif text-lg font-medium tracking-tight text-ink">
            Repo Manage
          </span>
          <Badge variant="pill" className="hidden sm:inline-flex text-[10px] py-0.5">
            Editorial v0.5
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-ink">
                {user.name || "Authenticated"}
              </span>
              <span className="text-[11px] text-muted-soft">{user.email}</span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-card text-xs font-semibold text-ink border border-hairline">
              {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
            </div>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                disabled={isSigningOut}
                className="rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-soft hover:text-error cursor-pointer disabled:opacity-50"
              >
                {isSigningOut ? "Signing out..." : "Sign Out"}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px]">
              Guest
            </Badge>
            <span className="text-xs font-medium text-muted">Sign In Required</span>
          </div>
        )}
      </div>
    </header>
  );
};
