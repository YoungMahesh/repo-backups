"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signUp, signOut } from "@/lib/auth-client";
import { TopNav } from "@/components/ui/top-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OrganizationCard,
  ConnectedInstallation,
} from "@/components/github/organization-card";
import {
  RepositoryInventoryTable,
  RepositoryItem,
} from "@/components/github/repository-inventory-table";
import {
  ArchivedBackupsSection,
  ArchivedInstallation,
} from "@/components/github/archived-backups-section";
import { GitHubAppSetupBanner } from "@/components/github/setup-banner";
import type { GitHubAppConfigStatus } from "@/lib/github/config";


export default function HomePage() {
  const router = useRouter();
  const {
    data: session,
    isPending: isSessionPending,
    error: sessionError,
  } = useSession();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRawSession, setShowRawSession] = useState(false);

  // GitHub backup data states
  const [installations, setInstallations] = useState<ConnectedInstallation[]>([]);
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [archivedInstallations, setArchivedInstallations] = useState<ArchivedInstallation[]>([]);
  const [archivedRepositories, setArchivedRepositories] = useState<RepositoryItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnectingId, setIsDisconnectingId] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<GitHubAppConfigStatus | null>(null);

  const checkSetupStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/github/setup-status");
      if (res.ok) {
        const data = await res.json();
        setSetupStatus(data);
      }
    } catch (err) {
      console.error("Failed to check GitHub setup status:", err);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function check() {
      try {
        const res = await fetch("/api/github/setup-status");
        if (res.ok && !ignore) {
          const data = await res.json();
          setSetupStatus(data);
        }
      } catch (err) {
        console.error("Failed to check GitHub setup status:", err);
      }
    }
    check();
    return () => {
      ignore = true;
    };
  }, []);


  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const switchMode = (newMode: "signin" | "signup") => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Inspect URL parameters for redirect outcomes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("connected") === "success") {
          const org = params.get("org");
          setSuccessMessage(
            org
              ? `Successfully connected GitHub organization "${org}" and authorized repositories.`
              : "Successfully connected GitHub organization and loaded authorized repositories.",
          );
        }
        const err = params.get("error");
        if (err) {
          setErrorMessage(err);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loadDashboardData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [instRes, repoRes, archivedInstRes, archivedRepoRes] = await Promise.all([
        fetch("/api/installations"),
        fetch("/api/repositories"),
        fetch("/api/installations?status=disconnected"),
        fetch("/api/repositories?status=disconnected"),
      ]);

      if (instRes.ok) {
        const instData = await instRes.json();
        setInstallations(instData.installations || []);
      }
      if (repoRes.ok) {
        const repoData = await repoRes.json();
        setRepositories(repoData.repositories || []);
      }
      if (archivedInstRes.ok) {
        const archivedInstData = await archivedInstRes.json();
        setArchivedInstallations(archivedInstData.installations || []);
      }
      if (archivedRepoRes.ok) {
        const archivedRepoData = await archivedRepoRes.json();
        setArchivedRepositories(archivedRepoData.repositories || []);
      }
      await checkSetupStatus();
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [checkSetupStatus]);


  useEffect(() => {
    let ignore = false;
    async function init() {
      if (session?.user) {
        setIsLoadingData(true);
        try {
          const [instRes, repoRes, archivedInstRes, archivedRepoRes] = await Promise.all([
            fetch("/api/installations"),
            fetch("/api/repositories"),
            fetch("/api/installations?status=disconnected"),
            fetch("/api/repositories?status=disconnected"),
          ]);
          if (!ignore && instRes.ok) {
            const instData = await instRes.json();
            setInstallations(instData.installations || []);
          }
          if (!ignore && repoRes.ok) {
            const repoData = await repoRes.json();
            setRepositories(repoData.repositories || []);
          }
          if (!ignore && archivedInstRes.ok) {
            const archivedInstData = await archivedInstRes.json();
            setArchivedInstallations(archivedInstData.installations || []);
          }
          if (!ignore && archivedRepoRes.ok) {
            const archivedRepoData = await archivedRepoRes.json();
            setArchivedRepositories(archivedRepoData.repositories || []);
          }
        } catch (err) {
          console.error("Failed to load dashboard data:", err);
        } finally {
          if (!ignore) setIsLoadingData(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [session?.user]);

  const handleSync = async (installationId: number) => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to sync repositories from GitHub");
      } else {
        setSuccessMessage(
          `Successfully synchronized ${data.count} authorized repositories from GitHub.`,
        );
        await loadDashboardData();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred during sync.",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async (inst: ConnectedInstallation) => {
    setIsDisconnectingId(inst.id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/installations/${inst.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to disconnect installation");
      } else {
        setSuccessMessage(
          `Successfully disconnected "${inst.accountLogin}". Historical backup bundles in S3 have been preserved.`,
        );
        await loadDashboardData();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during disconnection.",
      );
    } finally {
      setIsDisconnectingId(null);
    }
  };

  const handleUpdateRepository = async (
    repoId: string,
    updates: {
      backupEnabled?: boolean;
      backupSchedule?: "daily" | "weekly" | "manual";
    },
  ) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/repositories/${repoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update repository settings");
      }
      setRepositories((prev) =>
        prev.map((r) => (r.id === repoId ? { ...r, ...data.repository } : r)),
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to update repository backup configuration.";
      setErrorMessage(msg);
      throw err;
    }
  };

  const handleBackupNow = async (repoId: string) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/repositories/${repoId}/backup`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to execute on-demand backup.");
      }
      setSuccessMessage(
        `On-demand backup completed successfully! Bundle saved to S3 (${data.job.bundleSizeBytes} bytes, commit ${data.job.commitSha?.slice(0, 7)}).`,
      );
      await loadDashboardData();
    } catch (err) {
      console.error(`Failed to execute backup for repository ${repoId}:`, err);
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while running on-demand backup.";
      setErrorMessage(msg);
      throw err;
    }
  };


  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await signIn.email({
        email,
        password,
      });

      if (error) {
        setErrorMessage(
          error.message || "Failed to sign in. Please verify your credentials.",
        );
      } else {
        setSuccessMessage("Signed in successfully!");
        resetForm();
        router.refresh();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await signUp.email({
        name,
        email,
        password,
      });

      if (error) {
        setErrorMessage(
          error.message || "Failed to sign up. Please try again.",
        );
      } else {
        setSuccessMessage("Account created successfully!");
        resetForm();
        router.refresh();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during sign up.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            setSuccessMessage("Signed out successfully.");
            setInstallations([]);
            setRepositories([]);
            setArchivedInstallations([]);
            setArchivedRepositories([]);
            router.refresh();
          },
          onError: (ctx) => {
            setErrorMessage(ctx.error.message || "Failed to sign out.");
          },
        },
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to sign out.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink selection:bg-primary/20 selection:text-ink">
      <TopNav
        user={session?.user}
        onSignOut={session?.user ? handleSignOut : undefined}
        isSigningOut={isSubmitting}
      />

      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6 lg:px-8">
        <div
          className={`w-full space-y-8 ${
            session?.user ? "max-w-5xl" : "max-w-lg mt-8"
          }`}
        >
          {/* Headline */}
          <div className="text-center space-y-2">
            <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-ink">
              {session?.user
                ? "Repository Backup Dashboard"
                : "Welcome to Repo Manage"}
            </h1>
            <p className="font-sans text-sm text-body mx-auto max-w-lg">
              {session?.user
                ? "Manage connected GitHub organizations, inventory authorized repositories, and oversee automated Git bundle backups."
                : "A considered interface for managing and backing up your git repositories."}
            </p>
          </div>

          {/* Semantic Notifications */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-error/25 bg-error/10 p-4 text-xs text-error space-y-1"
            >
              <p className="font-semibold uppercase tracking-wider">Notice</p>
              <p>{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="rounded-md border border-success/25 bg-success/10 p-4 text-xs text-success space-y-1"
            >
              <p className="font-semibold uppercase tracking-wider">Success</p>
              <p>{successMessage}</p>
            </div>
          )}

          {sessionError && (
            <div
              role="alert"
              className="rounded-md border border-warning/25 bg-warning/10 p-4 text-xs text-warning space-y-1"
            >
              <p className="font-semibold uppercase tracking-wider">
                Session Notice
              </p>
              <p>{sessionError.message || "Failed to retrieve session."}</p>
            </div>
          )}

          {/* GitHub App Setup Banner when credentials are missing */}
          {setupStatus && !setupStatus.isConfigured && (
            <GitHubAppSetupBanner status={setupStatus} />
          )}

          {/* Main Content Area */}
          {isSessionPending ? (

            /* Loading Skeleton */
            <Card variant="feature" className="space-y-4 animate-pulse">
              <div className="h-6 w-1/2 rounded bg-surface-cream-strong mx-auto" />
              <div className="h-4 w-3/4 rounded bg-surface-soft mx-auto" />
              <div className="space-y-3 pt-4">
                <div className="h-10 rounded-md bg-surface-cream-strong" />
                <div className="h-10 rounded-md bg-surface-cream-strong" />
                <div className="h-10 rounded-md bg-surface-cream-strong" />
              </div>
            </Card>
          ) : session?.user ? (
            /* Authenticated Operations Dashboard */
            <div className="space-y-8">
              {/* Connected Organizations Section */}
              {installations.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-serif text-2xl font-normal text-ink">
                        Connected Organization
                      </h2>
                      <p className="font-sans text-xs text-muted">
                        GitHub App installation providing read-only repository access
                      </p>
                    </div>
                    <a
                      href="/api/github/connect"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-on-primary hover:bg-primary-active transition-colors shadow-xs"
                      data-testid="connect-additional-org-btn"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" />
                      </svg>
                      Connect Another Organization
                    </a>
                  </div>

                  <div className="space-y-4">
                    {installations.map((inst) => (
                      <OrganizationCard
                        key={inst.id}
                        installation={inst}
                        onSync={handleSync}
                        isSyncing={isSyncing}
                        onDisconnect={handleDisconnect}
                        isDisconnecting={isDisconnectingId === inst.id}
                      />
                    ))}
                  </div>

                  {/* Repository Inventory Table */}
                  <RepositoryInventoryTable
                    repositories={repositories}
                    isLoading={isLoadingData}
                    onUpdateRepository={handleUpdateRepository}
                    onBackupNow={handleBackupNow}
                  />
                </div>
              ) : (
                /* Unconnected State: Editorial Connect Callout */
                <div className="rounded-xl border border-hairline bg-surface-card p-8 sm:p-12 text-center space-y-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-canvas border border-hairline text-ink">
                    <svg
                      className="h-7 w-7"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                    </svg>
                  </div>

                  <div className="max-w-md mx-auto space-y-2">
                    <h2 className="font-serif text-2xl sm:text-3xl font-normal text-ink">
                      Connect your GitHub Organization
                    </h2>
                    <p className="font-sans text-sm text-body">
                      Authorize specific repositories via our fine-grained GitHub App.
                      We request strict read-only permissions to securely create complete
                      Git bundles in disaster recovery storage.
                    </p>
                  </div>

                  <div className="pt-2">
                    <a
                      href="/api/github/connect"
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-on-primary hover:bg-primary-active transition-colors shadow-sm"
                      data-testid="connect-github-btn"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                      </svg>
                      Connect GitHub Organization
                    </a>
                  </div>

                  {/* Security Highlights */}
                  <div className="pt-4 border-t border-hairline/60 flex flex-wrap items-center justify-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Read-only permissions (Contents &amp; Metadata)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Only select repositories authorized
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent-teal" />
                      Cryptographically signed callback
                    </span>
                  </div>
                </div>
              )}

              {/* Archived Backups Section */}
              <ArchivedBackupsSection
                archivedInstallations={archivedInstallations}
                archivedRepositories={archivedRepositories}
                isLoading={isLoadingData}
                onRevalidate={loadDashboardData}
                onPurgeSuccess={(msg) => setSuccessMessage(msg)}
              />

              {/* User Account / Session Accordion */}
              <div className="pt-4 border-t border-hairline">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted">
                    Signed in as{" "}
                    <span className="font-semibold text-ink">
                      {session.user.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRawSession(!showRawSession)}
                      className="text-xs text-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                    >
                      {showRawSession ? "Hide Details" : "Session Details"}
                    </button>
                    <span className="text-muted-soft">&bull;</span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-xs text-error hover:underline underline-offset-4 cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>

                {showRawSession && (
                  <div className="mt-4">
                    <Card
                      variant="code-window"
                      title="session.json"
                      subtitle="Better-Auth session payload"
                    >
                      <pre className="text-xs leading-relaxed text-on-dark overflow-x-auto">
                        {JSON.stringify(session, null, 2)}
                      </pre>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Logged-Out State: Editorial Tabs for Sign In & Sign Up */
            <Card variant="feature" className="p-0 overflow-hidden">
              <div className="flex border-b border-hairline bg-surface-soft/60 p-1.5 gap-1.5">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={`flex-1 py-2 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    mode === "signin"
                      ? "bg-canvas text-ink font-semibold shadow-xs border border-hairline/80"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`flex-1 py-2 text-center text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    mode === "signup"
                      ? "bg-canvas text-ink font-semibold shadow-xs border border-hairline/80"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 sm:p-8">
                {mode === "signin" ? (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <Input
                      label="Email"
                      id="signin-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />

                    <Input
                      label="Password"
                      id="signin-password"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        isLoading={isSubmitting}
                        className="w-full"
                      >
                        Sign In
                      </Button>
                    </div>

                    <p className="pt-2 text-center text-xs text-muted">
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("signup")}
                        className="text-primary hover:text-primary-active underline underline-offset-4 cursor-pointer"
                      >
                        Create one now
                      </button>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <Input
                      label="Name"
                      id="signup-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />

                    <Input
                      label="Email"
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />

                    <Input
                      label="Password"
                      id="signup-password"
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        isLoading={isSubmitting}
                        className="w-full"
                      >
                        Create Account
                      </Button>
                    </div>

                    <p className="pt-2 text-center text-xs text-muted">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("signin")}
                        className="text-primary hover:text-primary-active underline underline-offset-4 cursor-pointer"
                      >
                        Sign in
                      </button>
                    </p>
                  </form>
                )}
              </div>
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
