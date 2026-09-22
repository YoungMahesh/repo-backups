"use client";

import React, { useState } from "react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "permissions",
    question: "What permissions does the GitHub App require?",
    answer:
      "Our GitHub App requests strictly read-only access to repository contents and repository metadata on explicitly selected repositories. The application has zero write access to your code, cannot merge pull requests, cannot alter workflows, and cannot access organization billing or environment secrets.",
  },
  {
    id: "bundle-format",
    question: "Why does the platform use Git bundles (.bundle) instead of zip or tar archives?",
    answer:
      "Zip and tar files merely snapshot a single working tree state, completely discarding commit ancestry, branch pointers, author dates, and cryptographic GPG signatures. A Git bundle is a canonical, self-contained Git packfile encapsulating your full repository history. It allows you to verify ref integrity offline and reconstruct an authentic working repository using native 'git clone' without proprietary unpackers.",
  },
  {
    id: "storage-encryption",
    question: "How are backup bundles stored and encrypted in S3?",
    answer:
      "Backup bundles are streamed directly from memory into dedicated private S3 buckets. Every object is encrypted at rest using AES-256 Server-Side Encryption (SSE-S3 or AWS KMS). Bundles are never exposed publicly; authenticated downloads are generated through signed, time-limited presigned URLs with strict expiration limits.",
  },
  {
    id: "retention-windows",
    question: "How do Retention Windows work?",
    answer:
      "A Retention Window defines the maximum number of recent point-in-time Backup Bundles retained for a single Repository. When a newly scheduled or on-demand backup job completes successfully, older bundles that exceed your configured window threshold are automatically pruned from S3 and marked as pruned in the database, preventing runaway storage accumulation.",
  },
  {
    id: "disconnection-vs-purge",
    question: "What is the difference between Disconnection and Archive Purge?",
    answer:
      "Disconnection revokes GitHub App authorization and halts future scheduled backups, but preserves all historical Backup Bundles in S3 for disaster recovery and compliance audits. Archive Purge, by contrast, is a deliberate, permanent destruction initiated by the user that physically deletes historical S3 objects and cascades database record removal, leaving zero residual data.",
  },
];

export interface FAQAccordionProps {
  initialOpenItems?: Record<string, boolean>;
}

export const FAQAccordion: React.FC<FAQAccordionProps> = ({
  initialOpenItems = { permissions: true },
}) => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>(initialOpenItems);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section
      id="faq"
      data-testid="faq-section"
      className="w-full border-b border-hairline bg-canvas py-16 sm:py-24"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-3 mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Answers &amp; Technical Detail
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-ink">
            Frequently Asked Questions
          </h2>
          <p className="font-sans text-sm sm:text-base text-body">
            Everything you need to know about permissions, storage security, and Git bundle restoration.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => {
            const isOpen = Boolean(openItems[item.id]);
            return (
              <div
                key={item.id}
                data-testid={`faq-item-${item.id}`}
                className="rounded-lg border border-hairline bg-surface-card overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  id={`faq-question-${item.id}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${item.id}`}
                  data-testid={`faq-button-${item.id}`}
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-center justify-between p-5 sm:p-6 text-left font-serif text-lg sm:text-xl font-normal text-ink cursor-pointer hover:bg-surface-soft/50 transition-colors"
                >
                  <span>{item.question}</span>
                  <svg
                    className={`h-5 w-5 text-muted transition-transform duration-200 shrink-0 ml-4 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${item.id}`}
                    role="region"
                    aria-labelledby={`faq-question-${item.id}`}
                    data-testid={`faq-answer-${item.id}`}
                    className="px-5 sm:px-6 pb-6 pt-1 font-sans text-sm leading-relaxed text-body border-t border-hairline/60 bg-canvas/40"
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
