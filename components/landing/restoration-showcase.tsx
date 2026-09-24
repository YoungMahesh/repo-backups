import React from "react";

export const RestorationShowcase: React.FC = () => {
  return (
    <section
      id="restoration"
      data-testid="restoration-showcase-section"
      className="w-full border-b border-hairline bg-canvas py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Restoration Narrative */}
          <div className="space-y-6 lg:col-span-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Restoration Guide
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-ink">
              One Standard Git Command. No Proprietary Tooling.
            </h2>
            <p className="font-sans text-sm sm:text-base leading-relaxed text-body">
              True disaster recovery means sovereign independence. If our servers disappear,
              your backup bundles remain fully restorable using nothing more than standard
              Git on any Linux, macOS, or Windows machine.
            </p>

            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-hairline bg-surface-card p-4 space-y-1.5">
                <h4 className="font-serif text-base font-medium text-ink">
                  Cryptographic Ref Integrity
                </h4>
                <p className="font-sans text-xs text-body leading-relaxed">
                  Every commit SHA-1/SHA-256, merge parent, branch HEAD, and annotated tag is
                  preserved inside the bundle&apos;s packfile format. Verification confirms complete
                  ancestry before restoration.
                </p>
              </div>

              <div className="rounded-lg border border-hairline bg-surface-card p-4 space-y-1.5">
                <h4 className="font-serif text-base font-medium text-ink">
                  Zero Lock-In Guarantee
                </h4>
                <p className="font-sans text-xs text-body leading-relaxed">
                  We don&apos;t use proprietary databases or obfuscated zip dumps. A Git bundle
                  is an official, standard Git transport format supported natively by every version
                  of Git released since 2007.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Code Walkthrough */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-surface-dark-elevated bg-surface-dark text-on-dark shadow-lg overflow-hidden font-mono text-xs">
              {/* Terminal Title Bar */}
              <div className="flex items-center justify-between border-b border-surface-dark-elevated bg-surface-dark-soft/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-teal" />
                  <span className="font-sans text-xs text-on-dark-soft">
                    Restoration Guide — Step-by-Step
                  </span>
                </div>
                <span className="rounded bg-surface-dark-elevated px-2 py-0.5 text-[11px] text-accent-amber font-sans">
                  Offline Capable
                </span>
              </div>

              {/* Code Snippets */}
              <div className="p-5 space-y-6">
                {/* Step 1 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-on-dark-soft font-sans text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-dark-elevated font-mono text-[10px] text-primary">
                      1
                    </span>
                    <span>Download timestamped bundle via presigned URL:</span>
                  </div>
                  <div className="rounded-md bg-surface-dark-soft p-3 border border-surface-dark-elevated overflow-x-auto text-on-dark">
                    <code>
                      curl -o repository-2026-09-22T040000Z.bundle \
                      <br />
                      &nbsp;&nbsp;&quot;https://s3.amazonaws.com/repo-backups-vault/...?AWSAccessKeyId=...&quot;
                    </code>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-on-dark-soft font-sans text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-dark-elevated font-mono text-[10px] text-primary">
                      2
                    </span>
                    <span>Verify packfile and branch ref integrity:</span>
                  </div>
                  <div className="rounded-md bg-surface-dark-soft p-3 border border-surface-dark-elevated overflow-x-auto text-accent-teal">
                    <code>
                      $ git bundle verify repository-2026-09-22T040000Z.bundle
                      <br />
                      <span className="text-success">The bundle records a complete commit graph. OK.</span>
                    </code>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-on-dark-soft font-sans text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-dark-elevated font-mono text-[10px] text-primary">
                      3
                    </span>
                    <span>Clone complete repository locally into new directory:</span>
                  </div>
                  <div className="rounded-md bg-surface-dark-soft p-3 border border-surface-dark-elevated overflow-x-auto text-primary">
                    <code>
                      $ git clone repository-2026-09-22T040000Z.bundle restored-repository
                      <br />
                      <span className="text-on-dark-soft text-[11px]">
                        # Rebuilds master/main, all feature branches, and annotated release tags
                      </span>
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
