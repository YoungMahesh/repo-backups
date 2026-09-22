import React from "react";

export const SecurityLifecycle: React.FC = () => {
  return (
    <section
      id="security"
      data-testid="security-lifecycle-section"
      className="w-full border-b border-hairline bg-surface-soft py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Data Governance &amp; Lifecycle
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-ink">
            Clear Boundaries: Disconnection vs. Archive Purge
          </h2>
          <p className="font-sans text-sm sm:text-base text-body">
            You maintain full sovereignty over your code. We decouple backup cessation from data
            destruction so compliance requirements and retention obligations are never violated
            accidentally.
          </p>
        </div>

        {/* Comparative Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Disconnection */}
          <div
            data-testid="disconnection-card"
            className="rounded-lg border border-hairline bg-canvas p-6 sm:p-8 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-surface-card border border-hairline px-3 py-1 text-xs font-medium text-ink">
                Administrative Control
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-warning" />
            </div>

            <h3 className="font-serif text-2xl font-normal text-ink">
              Disconnection
            </h3>

            <p className="font-sans text-sm leading-relaxed text-body">
              Severing an Installation revokes GitHub App authorization and transitions the account
              to a Disconnected Installation. Scheduled backup jobs and webhook synchronization
              halt immediately.
            </p>

            <div className="pt-4 border-t border-hairline space-y-2.5 text-xs text-muted">
              <div className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-success mt-1 shrink-0" />
                <span>
                  <strong className="text-ink">Preserves Historical Bundles:</strong> Existing
                  Backup Bundles in S3 remain safely archived and available for download.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-success mt-1 shrink-0" />
                <span>
                  <strong className="text-ink">Stops Future Backups:</strong> No automated jobs
                  or tokens are ever invoked again.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-success mt-1 shrink-0" />
                <span>
                  <strong className="text-ink">Reconnection Ready:</strong> If desired, the
                  organization can be reconnected without losing previous backup history.
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Archive Purge */}
          <div
            data-testid="archive-purge-card"
            className="rounded-lg border border-hairline bg-canvas p-6 sm:p-8 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-error/10 border border-error/20 px-3 py-1 text-xs font-medium text-error">
                Permanent Destruction
              </span>
              <span className="h-2.5 w-2.5 rounded-full bg-error" />
            </div>

            <h3 className="font-serif text-2xl font-normal text-ink">
              Archive Purge
            </h3>

            <p className="font-sans text-sm leading-relaxed text-body">
              An explicit, user-initiated action designed for compliance with GDPR &quot;Right to be
              Forgotten&quot; mandates and data decommissioning policies. Requires deliberate user
              confirmation.
            </p>

            <div className="pt-4 border-t border-hairline space-y-2.5 text-xs text-muted">
              <div className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-error mt-1 shrink-0" />
                <span>
                  <strong className="text-ink">Physical S3 Deletion:</strong> All Backup Bundles
                  and associated S3 objects are permanently deleted from object storage.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-error mt-1 shrink-0" />
                <span>
                  <strong className="text-ink">Database Purge:</strong> All metadata records,
                  commit SHA references, and job logs are purged from the database.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-error mt-1 shrink-0" />
                <span>
                  <strong className="text-ink">Zero Residual Data:</strong> Cryptographic and
                  physical removal leaves zero recoverable traces behind.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
