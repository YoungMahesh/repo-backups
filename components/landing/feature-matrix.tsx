import React from "react";

interface Pillar {
  id: string;
  title: string;
  badge: string;
  description: string;
  details: string[];
  icon: React.ReactNode;
}

const PILLARS: Pillar[] = [
  {
    id: "read-only-scoping",
    title: "Strict Read-Only Scoping",
    badge: "Zero Write Access",
    description:
      "Our GitHub App requests exclusively contents:read and metadata:read permissions on explicitly selected repositories. The platform possesses zero write capability, cannot modify code, alter workflows, or touch environment secrets.",
    details: [
      "Fine-grained GitHub App repository selection",
      "Short-lived cryptographic installation tokens",
      "Zero pull request or branch write access",
    ],
    icon: (
      <svg
        className="h-6 w-6 text-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: "true-git-bundles",
    title: "True Git Bundles (.bundle)",
    badge: "Native Git Archive",
    description:
      "Unlike flat tarballs or zip archives that discard branch references and tag histories, our engine generates canonical Git bundle files. Every commit, branch ref, annotated tag, and detached head is cryptographically preserved.",
    details: [
      "Complete object database and packfile packaging",
      "Full commit graph and merge topology intact",
      "Cryptographically verifiable via git bundle verify",
    ],
    icon: (
      <svg
        className="h-6 w-6 text-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="12" y1="6" x2="12" y2="12" />
        <line x1="9" y1="9" x2="15" y2="9" />
      </svg>
    ),
  },
  {
    id: "retention-windows",
    title: "Automated Retention Windows",
    badge: "Rolling Snapshots",
    description:
      "Define predictable rolling retention windows per repository. As scheduled daily or weekly backup jobs complete, older bundles beyond the configured threshold are safely pruned, controlling storage growth without manual intervention.",
    details: [
      "Configurable rolling bundle capacity per repository",
      "Automated post-backup pruning in Amazon S3",
      "Zero orphaned database records or dangling S3 keys",
    ],
    icon: (
      <svg
        className="h-6 w-6 text-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: "native-restoration",
    title: "One-Command Native Restoration",
    badge: "Zero Platform Lock-In",
    description:
      "When disaster strikes or compliance audits occur, restore complete repository history with git clone <bundle-file>. No proprietary unpacking agents, no platform APIs, and no vendor lock-in are ever required.",
    details: [
      "Works out of the box with standard native Git",
      "Instant offline restoration on any developer workstation",
      "Includes all remote branches and tagged releases",
    ],
    icon: (
      <svg
        className="h-6 w-6 text-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
];

export const FeatureMatrix: React.FC = () => {
  return (
    <section
      id="features"
      data-testid="feature-matrix-section"
      className="w-full border-b border-hairline bg-canvas py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Architecture Pillars
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-ink">
            Engineered for Sovereignty, Scoped for Zero Trust
          </h2>
          <p className="font-sans text-sm sm:text-base text-body">
            Four structural guarantees protecting your organization&apos;s source code,
            commit lineage, and business continuity.
          </p>
        </div>

        {/* 4-Pillar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.id}
              data-testid={`feature-card-${pillar.id}`}
              className="flex flex-col justify-between rounded-lg border border-hairline bg-surface-card p-6 sm:p-8 transition-shadow hover:shadow-sm"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-canvas border border-hairline">
                    {pillar.icon}
                  </div>
                  <span className="rounded-full bg-surface-cream-strong px-2.5 py-1 text-[11px] font-medium text-ink">
                    {pillar.badge}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-serif text-2xl font-normal text-ink">
                    {pillar.title}
                  </h3>
                  <p className="font-sans text-sm leading-relaxed text-body">
                    {pillar.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-hairline/80 space-y-2">
                {pillar.details.map((detail, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs text-muted"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
