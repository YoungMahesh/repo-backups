import React from "react";
import Link from "next/link";
import { TerminalDemo } from "./terminal-demo";

export interface HeroSectionProps {
  isAuthenticated?: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isAuthenticated = false,
}) => {
  return (
    <section className="w-full border-b border-hairline bg-canvas py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Editorial Copy */}
          <div className="space-y-6 lg:col-span-6 lg:pr-4">
            {/* Domain Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-card px-3 py-1 text-xs font-medium text-ink">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span>Read-Only Scoped &bull; Native Git Bundles</span>
            </div>

            {/* Serif Display Headline */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal leading-[1.08] tracking-tight text-ink">
              Sovereign repository backups, verifiable to the last commit.
            </h1>

            {/* Humanist Value Proposition Body */}
            <p className="font-sans text-base sm:text-lg leading-relaxed text-body">
              Connect your GitHub organizations with strict read-only permissions.
              Our automated engine archives complete commit graphs into deterministic,
              point-in-time Git bundles streamed to encrypted S3 storage—restorable anywhere
              with standard Git tooling and zero vendor lock-in.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href={isAuthenticated ? "/dashboard" : "/login"}
                data-testid="hero-primary-cta"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active shadow-sm cursor-pointer"
              >
                {isAuthenticated ? "Go to Dashboard" : "Start Backing Up"}
              </Link>
              <a
                href="#restoration"
                className="inline-flex h-11 items-center justify-center rounded-md border border-hairline bg-canvas px-5 text-sm font-medium text-ink transition-colors hover:bg-surface-soft cursor-pointer"
              >
                Inspect Restoration Guide
              </a>
            </div>

            {/* Security Proof Points */}
            <div className="pt-6 border-t border-hairline/80 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-muted">
              <div className="space-y-1">
                <span className="font-semibold text-ink block">Zero Write Scopes</span>
                <span>GitHub App is strictly read-only</span>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-ink block">True .bundle Format</span>
                <span>Includes branches, tags &amp; HEADs</span>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-ink block">AES-256 KMS</span>
                <span>Encrypted private S3 storage</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Terminal Demo */}
          <div className="w-full lg:col-span-6">
            <TerminalDemo />
          </div>
        </div>
      </div>
    </section>
  );
};
