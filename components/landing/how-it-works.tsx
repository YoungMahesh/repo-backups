import React from "react";

interface Step {
  number: string;
  title: string;
  description: string;
  technicalNote: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Connect Scoped GitHub App",
    description:
      "Install our GitHub App into your organization or personal account. Select the precise repositories you wish to protect with strict read-only permissions for contents and metadata.",
    technicalNote:
      "Uses state-signed OAuth callbacks and fine-grained installation IDs isolated per account.",
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
        <path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Automated Bundle Streaming",
    description:
      "Our headless worker executes scheduled or on-demand backup jobs. It authenticates with short-lived tokens, generates a complete Git bundle packfile, and streams it directly to your encrypted S3 bucket.",
    technicalNote:
      "Packfiles are verified for ref completeness and encrypted with AWS KMS/SSE-S3 at rest.",
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
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Independent Point-in-Time Restore",
    description:
      "In the event of an outage, accidental deletion, or ransomware attack, generate secure presigned download URLs. Restore full commit history and branch trees with a single native git clone command.",
    technicalNote:
      "100% offline recovery capable. Zero reliance on our platform API during emergency restoration.",
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
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section
      id="how-it-works"
      data-testid="how-it-works-section"
      className="w-full border-b border-hairline bg-surface-soft py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Operational Lifecycle
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-ink">
            Three Steps from Installation to Disaster Recovery
          </h2>
          <p className="font-sans text-sm sm:text-base text-body">
            A transparent pipeline connecting your GitHub organizations to encrypted S3 storage,
            retaining verified bundles ready for immediate restoration.
          </p>
        </div>

        {/* Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div
              key={step.number}
              data-testid={`how-it-works-step-${step.number}`}
              className="flex flex-col justify-between rounded-lg border border-hairline bg-canvas p-6 sm:p-8 relative transition-shadow hover:shadow-sm"
            >
              {/* Step indicator watermark */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-2xl font-bold text-primary/80">
                  {step.number}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-card border border-hairline">
                  {step.icon}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-serif text-xl font-normal text-ink">
                  {step.title}
                </h3>
                <p className="font-sans text-xs sm:text-sm leading-relaxed text-body">
                  {step.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-hairline text-xs font-mono text-muted-soft bg-surface-soft/40 -mx-6 -mb-6 p-4 rounded-b-lg">
                <span className="font-semibold text-muted block mb-0.5">Architecture Seam:</span>
                {step.technicalNote}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
