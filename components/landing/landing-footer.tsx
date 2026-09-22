import React from "react";
import Link from "next/link";

export interface LandingFooterProps {
  isAuthenticated?: boolean;
}

export const CtaBandCoral: React.FC<LandingFooterProps> = ({
  isAuthenticated = false,
}) => {
  return (
    <section className="w-full bg-canvas py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-primary px-8 py-12 sm:px-12 sm:py-16 text-center text-on-primary shadow-sm space-y-6">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-on-primary">
              Protect your organization&apos;s Git repositories today.
            </h2>
            <p className="font-sans text-sm sm:text-base text-on-primary/90 max-w-xl mx-auto">
              Automate cryptographically verified Git bundle backups scoped strictly to read-only
              permissions. Complete sovereignty over every commit, branch, and tag.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href={isAuthenticated ? "/dashboard" : "/login"}
              data-testid="cta-band-button"
              className="inline-flex h-11 items-center justify-center rounded-md bg-canvas px-6 text-sm font-medium text-ink transition-colors hover:bg-surface-soft shadow-xs cursor-pointer"
            >
              {isAuthenticated ? "Go to Dashboard" : "Start Backing Up"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export const LandingFooter: React.FC = () => {
  return (
    <footer
      data-testid="landing-footer"
      className="w-full border-t border-surface-dark-elevated bg-surface-dark text-on-dark-soft py-14 sm:py-16 font-sans text-xs"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top Wordmark & Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Column 1: Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-on-dark">
              {/* Anthropic 4-Spoke Radial Mark */}
              <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-surface-dark-elevated text-on-dark">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-on-dark"
                  aria-hidden="true"
                >
                  <line x1="12" y1="2" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
                </svg>
              </div>
              <span className="font-serif text-lg font-normal tracking-tight text-on-dark">
                Repo Manage
              </span>
            </div>
            <p className="text-on-dark-soft leading-relaxed pr-4">
              Automated, sovereign Git bundle disaster recovery backups for GitHub organizations.
            </p>
          </div>

          {/* Column 2: Product */}
          <div className="space-y-3">
            <p className="font-semibold uppercase tracking-wider text-on-dark text-[11px]">
              Product
            </p>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="hover:text-on-dark transition-colors">
                  Architecture Pillars
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-on-dark transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#restoration" className="hover:text-on-dark transition-colors">
                  Restoration Guide
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-on-dark transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Security & Governance */}
          <div className="space-y-3">
            <p className="font-semibold uppercase tracking-wider text-on-dark text-[11px]">
              Security &amp; Governance
            </p>
            <ul className="space-y-2">
              <li>
                <a href="#security" className="hover:text-on-dark transition-colors">
                  Read-Only Scoping
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-on-dark transition-colors">
                  Disconnection Safeguards
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-on-dark transition-colors">
                  User Archive Purge
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-on-dark transition-colors">
                  S3 SSE-S3 Encryption
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Platform */}
          <div className="space-y-3">
            <p className="font-semibold uppercase tracking-wider text-on-dark text-[11px]">
              Access
            </p>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="hover:text-on-dark transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-on-dark transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-on-dark transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Notice */}
        <div className="pt-8 border-t border-surface-dark-elevated flex flex-col sm:flex-row items-center justify-between gap-4 text-on-dark-soft">
          <div>
            &copy; {new Date().getFullYear()} Repo Manage. All rights reserved. Sovereign Git bundle backups.
          </div>
          <div className="flex items-center gap-6">
            <span>Warm-Canvas Editorial System</span>
            <span>AES-256 S3</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
