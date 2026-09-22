"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { TopNav } from "@/components/ui/top-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { FeatureMatrix } from "@/components/landing/feature-matrix";
import { HowItWorks } from "@/components/landing/how-it-works";
import { RestorationShowcase } from "@/components/landing/restoration-showcase";
import { SecurityLifecycle } from "@/components/landing/security-lifecycle";
import { FAQAccordion } from "@/components/landing/faq-accordion";
import { CtaBandCoral, LandingFooter } from "@/components/landing/landing-footer";

export default function HomePage() {
  const { data: session } = useSession();

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Surface any redirect query parameters (e.g. from GitHub App callbacks)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("connected") === "success") {
          const org = params.get("org");
          setNotification({
            type: "success",
            message: org
              ? `Successfully connected GitHub organization "${org}". Access your dashboard to view authorized repositories.`
              : "Successfully connected GitHub organization. Access your dashboard to view authorized repositories.",
          });
        } else if (params.get("error")) {
          setNotification({
            type: "error",
            message: params.get("error") || "An error occurred during GitHub authorization.",
          });
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const isAuthenticated = Boolean(session?.user);

  return (
    <div
      data-testid="landing-page"
      className="flex min-h-screen flex-col bg-canvas text-ink selection:bg-primary/20 selection:text-ink"
    >
      {/* Dynamic Session-Aware Top Navigation */}
      <TopNav
        isLandingPage={true}
        user={session?.user}
      />

      {/* Query Notification Banner (if redirected from OAuth) */}
      {notification && (
        <div className="w-full border-b border-hairline bg-surface-soft px-4 py-3 sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div
              role={notification.type === "error" ? "alert" : "status"}
              className={`text-xs ${
                notification.type === "error" ? "text-error font-medium" : "text-success font-medium"
              }`}
            >
              {notification.message}
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-xs text-muted hover:text-ink cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Editorial Content */}
      <main className="flex flex-1 flex-col items-center">
        {/* Hero Band with Interactive Terminal Demo */}
        <HeroSection isAuthenticated={isAuthenticated} />

        {/* 4-Pillar Feature Matrix */}
        <FeatureMatrix />

        {/* 3-Step How It Works Walkthrough */}
        <HowItWorks />

        {/* Canonical Restoration Guide Showcase */}
        <RestorationShowcase />

        {/* Security & Data Governance (Disconnection vs. Archive Purge) */}
        <SecurityLifecycle />

        {/* Accessible FAQ Accordion */}
        <FAQAccordion />

        {/* Pre-Footer Callout Band */}
        <CtaBandCoral isAuthenticated={isAuthenticated} />
      </main>

      {/* Dark Navy Editorial Footer */}
      <LandingFooter />
    </div>
  );
}
