import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { TopNav } from "@/components/ui/top-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { TerminalDemo } from "@/components/landing/terminal-demo";
import { FeatureMatrix } from "@/components/landing/feature-matrix";
import { HowItWorks } from "@/components/landing/how-it-works";
import { RestorationShowcase } from "@/components/landing/restoration-showcase";
import { SecurityLifecycle } from "@/components/landing/security-lifecycle";
import { FAQAccordion } from "@/components/landing/faq-accordion";
import { CtaBandCoral, LandingFooter } from "@/components/landing/landing-footer";

describe("Public Editorial Landing Page & Components (Spec: Landing Page)", () => {
  describe("TopNav (Session-Aware Marketing Navigation)", () => {
    it("renders unauthenticated landing navigation with marketing anchors and login CTAs", () => {
      const html = renderToString(<TopNav isLandingPage={true} user={null} />);

      expect(html).toContain("Repo Backups");
      expect(html).toContain("Features");
      expect(html).toContain("How It Works");
      expect(html).toContain("Restoration");
      expect(html).toContain("Security");
      expect(html).toContain("FAQ");
      expect(html).toContain("href=\"#features\"");
      expect(html).toContain("href=\"#how-it-works\"");
      expect(html).toContain("href=\"#restoration\"");
      expect(html).toContain("href=\"#security\"");
      expect(html).toContain("href=\"#faq\"");
      expect(html).toContain("data-testid=\"landing-signin-btn\"");
      expect(html).toContain("Sign In");
      expect(html).toContain("data-testid=\"landing-start-backup-btn\"");
      expect(html).toContain("Start Backing Up");
      expect(html).toContain("href=\"/login\"");
    });

    it("renders authenticated landing navigation with direct 'Go to Dashboard' CTA", () => {
      const mockUser = {
        name: "Security Lead",
        email: "lead@example.com",
      };
      const html = renderToString(<TopNav isLandingPage={true} user={mockUser} />);

      expect(html).toContain("Repo Backups");
      expect(html).toContain("data-testid=\"landing-dashboard-btn\"");
      expect(html).toContain("Go to Dashboard");
      expect(html).toContain("href=\"/dashboard\"");
      expect(html).toContain("Security Lead");
      expect(html).toContain("lead@example.com");
      expect(html).toContain(">S<"); // monogram
      // Should not show generic guest badge or sign in prompt
      expect(html).not.toContain("Sign In Required");
    });
  });

  describe("HeroSection", () => {
    it("renders display serif headline, humanist value prop, and unauthenticated CTAs", () => {
      const html = renderToString(<HeroSection isAuthenticated={false} />);

      expect(html).toContain("Sovereign repository backups, verifiable to the last commit.");
      expect(html).toContain("font-serif");
      expect(html).toContain("strict read-only permissions");
      expect(html).toContain("point-in-time Git bundles");
      expect(html).toContain("data-testid=\"hero-primary-cta\"");
      expect(html).toContain("Start Backing Up");
      expect(html).toContain("href=\"/login\"");
      expect(html).toContain("Inspect Restoration Guide");
      expect(html).toContain("href=\"#restoration\"");
      expect(html).toContain("Zero Write Scopes");
      expect(html).toContain("True .bundle Format");
      expect(html).toContain("AES-256 KMS");
    });

    it("renders 'Go to Dashboard' CTA when user is authenticated", () => {
      const html = renderToString(<HeroSection isAuthenticated={true} />);

      expect(html).toContain("data-testid=\"hero-primary-cta\"");
      expect(html).toContain("Go to Dashboard");
      expect(html).toContain("href=\"/dashboard\"");
    });
  });

  describe("TerminalDemo (Interactive Restoration Inspector)", () => {
    it("renders verify tab by default with ref verification output and copy button", () => {
      const html = renderToString(<TerminalDemo />);

      expect(html).toContain("data-testid=\"terminal-demo\"");
      expect(html).toContain("data-testid=\"terminal-copy-button\"");
      expect(html).toContain("git bundle verify");
      expect(html).toContain("git bundle verify backups/core-api-2026-09-22T040000Z.bundle");
      expect(html).toContain("refs/heads/main");
      expect(html).toContain("refs/tags/v2.4.1");
      expect(html).toContain("Ref and commit integrity verification: OK");
      expect(html).toContain("data-testid=\"tab-verify\"");
      expect(html).toContain("aria-selected=\"true\"");
    });

    it("renders clone tab showing one-command repository reconstruction", () => {
      const html = renderToString(<TerminalDemo initialTab="clone" />);

      expect(html).toContain("git clone backups/core-api-2026-09-22T040000Z.bundle core-api-restored");
      expect(html).toContain("Cloning into &#x27;core-api-restored&#x27;...");
      expect(html).toContain("Local repository successfully reconstructed from Git bundle.");
      expect(html).toContain("Zero platform dependencies required.");
      expect(html).toContain("data-testid=\"tab-clone\"");
    });

    it("renders s3 tab showing S3 storage layout and AES-256 KMS encryption", () => {
      const html = renderToString(<TerminalDemo initialTab="s3" />);

      expect(html).toContain("aws s3 ls s3://repo-backups/installations/");
      expect(html).toContain("StorageClass:          STANDARD");
      expect(html).toContain("ServerSideEncryption:  aws:kms (aws/s3)");
      expect(html).toContain("Retention Window active: 10 snapshots retained");
      expect(html).toContain("data-testid=\"tab-s3\"");
    });
  });

  describe("FeatureMatrix", () => {
    it("renders four core platform pillars with domain terminology", () => {
      const html = renderToString(<FeatureMatrix />);

      expect(html).toContain("data-testid=\"feature-matrix-section\"");
      expect(html).toContain("Engineered for Sovereignty, Scoped for Zero Trust");

      // Pillar 1: Read-Only Scoping
      expect(html).toContain("data-testid=\"feature-card-read-only-scoping\"");
      expect(html).toContain("Strict Read-Only Scoping");
      expect(html).toContain("contents:read");
      expect(html).toContain("metadata:read");

      // Pillar 2: True Git Bundles
      expect(html).toContain("data-testid=\"feature-card-true-git-bundles\"");
      expect(html).toContain("True Git Bundles (.bundle)");
      expect(html).toContain("git bundle verify");

      // Pillar 3: Retention Windows
      expect(html).toContain("data-testid=\"feature-card-retention-windows\"");
      expect(html).toContain("Automated Retention Windows");
      expect(html).toContain("rolling retention windows");

      // Pillar 4: Native Restoration
      expect(html).toContain("data-testid=\"feature-card-native-restoration\"");
      expect(html).toContain("One-Command Native Restoration");
      expect(html).toContain("git clone &lt;bundle-file&gt;");
    });
  });

  describe("HowItWorks", () => {
    it("renders 3-step operational lifecycle from installation to restoration", () => {
      const html = renderToString(<HowItWorks />);

      expect(html).toContain("data-testid=\"how-it-works-section\"");
      expect(html).toContain("Three Steps from Installation to Disaster Recovery");
      expect(html).toContain("data-testid=\"how-it-works-step-01\"");
      expect(html).toContain("Connect Scoped GitHub App");
      expect(html).toContain("data-testid=\"how-it-works-step-02\"");
      expect(html).toContain("Automated Bundle Streaming");
      expect(html).toContain("data-testid=\"how-it-works-step-03\"");
      expect(html).toContain("Independent Point-in-Time Restore");
    });
  });

  describe("RestorationShowcase", () => {
    it("renders canonical Restoration Guide commands and ref integrity explanation", () => {
      const html = renderToString(<RestorationShowcase />);

      expect(html).toContain("data-testid=\"restoration-showcase-section\"");
      expect(html).toContain("One Standard Git Command. No Proprietary Tooling.");
      expect(html).toContain("Cryptographic Ref Integrity");
      expect(html).toContain("Zero Lock-In Guarantee");
      expect(html).toContain("curl -o repository-2026-09-22T040000Z.bundle");
      expect(html).toContain("git bundle verify repository-2026-09-22T040000Z.bundle");
      expect(html).toContain("git clone repository-2026-09-22T040000Z.bundle restored-repository");
    });
  });

  describe("SecurityLifecycle", () => {
    it("renders Disconnection and Archive Purge comparative governance cards", () => {
      const html = renderToString(<SecurityLifecycle />);

      expect(html).toContain("data-testid=\"security-lifecycle-section\"");
      expect(html).toContain("Clear Boundaries: Disconnection vs. Archive Purge");
      expect(html).toContain("data-testid=\"disconnection-card\"");
      expect(html).toContain("Disconnection");
      expect(html).toContain("Preserves Historical Bundles");
      expect(html).toContain("data-testid=\"archive-purge-card\"");
      expect(html).toContain("Archive Purge");
      expect(html).toContain("Physical S3 Deletion");
      expect(html).toContain("Zero Residual Data");
    });
  });

  describe("FAQAccordion", () => {
    it("renders 5 questions with first item open by default", () => {
      const html = renderToString(<FAQAccordion />);

      expect(html).toContain("data-testid=\"faq-section\"");
      expect(html).toContain("Frequently Asked Questions");
      expect(html).toContain("data-testid=\"faq-item-permissions\"");
      expect(html).toContain("data-testid=\"faq-item-bundle-format\"");
      expect(html).toContain("data-testid=\"faq-item-storage-encryption\"");
      expect(html).toContain("data-testid=\"faq-item-retention-windows\"");
      expect(html).toContain("data-testid=\"faq-item-disconnection-vs-purge\"");

      // Default state: permissions is open
      expect(html).toContain("data-testid=\"faq-answer-permissions\"");
      expect(html).toContain("Our GitHub App requests strictly read-only access");
      expect(html).toContain("aria-expanded=\"true\"");
    });

    it("renders specific item open when configured", () => {
      const html = renderToString(
        <FAQAccordion
          initialOpenItems={{ permissions: false, "bundle-format": true }}
        />,
      );

      expect(html).toContain("data-testid=\"faq-answer-bundle-format\"");
      expect(html).toContain("A Git bundle is a canonical, self-contained Git packfile");
      // permissions answer should not be present
      expect(html).not.toContain("data-testid=\"faq-answer-permissions\"");
    });
  });

  describe("CtaBandCoral & LandingFooter", () => {
    it("renders coral CTA band with Start Backing Up button", () => {
      const html = renderToString(<CtaBandCoral isAuthenticated={false} />);

      expect(html).toContain("Protect your organization&#x27;s Git repositories today.");
      expect(html).toContain("data-testid=\"cta-band-button\"");
      expect(html).toContain("Start Backing Up");
      expect(html).toContain("href=\"/login\"");
    });

    it("renders dark navy footer with brand, links, and domain notes", () => {
      const html = renderToString(<LandingFooter />);

      expect(html).toContain("data-testid=\"landing-footer\"");
      expect(html).toContain("bg-surface-dark");
      expect(html).toContain("Repo Backups");
      expect(html).toContain("Architecture Pillars");
      expect(html).toContain("Restoration Guide");
      expect(html).toContain("Read-Only Scoping");
      expect(html).toContain("User Archive Purge");
      expect(html).toContain("Sign In");
      expect(html).toContain("Dashboard");
      expect(html).toContain("Sovereign Git bundle backups");
    });
  });
});
