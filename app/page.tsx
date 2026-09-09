"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signUp, signOut } from "@/lib/auth-client";
import { TopNav } from "@/components/ui/top-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg space-y-8">
          {/* Editorial Headline */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-sans text-xs uppercase tracking-wider text-muted font-medium">
                Anthropic Warm-Canvas Editorial
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-ink">
              {session?.user
                ? "Repository Workspace"
                : "Welcome to Repo Manage"}
            </h1>
            <p className="font-sans text-sm text-body mx-auto max-w-sm">
              {session?.user
                ? "Manage connected repositories, sync workflows, and review activity logs."
                : "A considered interface for managing and understanding your repositories."}
            </p>
          </div>

          {/* Semantic Notifications */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-error/25 bg-error/10 p-4 text-xs text-error space-y-1"
            >
              <p className="font-semibold uppercase tracking-wider">Error</p>
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

          {/* Main Card Container */}
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
            /* Logged-In State */
            <div className="space-y-6">
              <Card variant="feature" className="space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-canvas text-lg font-serif font-medium text-ink border border-hairline">
                      {(
                        session.user.name?.[0] ||
                        session.user.email?.[0] ||
                        "U"
                      ).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-ink">
                        {session.user.name || "Authenticated User"}
                      </h2>
                      <p className="text-xs text-muted">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">Active Session</Badge>
                </div>

                {/* Session Details */}
                <div className="rounded-md border border-hairline bg-canvas/80 p-4 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">User ID</span>
                    <span className="font-mono text-ink truncate max-w-[220px]">
                      {session.user.id}
                    </span>
                  </div>
                  {session.session?.id && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Session ID</span>
                      <span className="font-mono text-ink truncate max-w-[220px]">
                        {session.session.id}
                      </span>
                    </div>
                  )}
                  {session.session?.expiresAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Expires At</span>
                      <span className="text-ink">
                        {new Date(session.session.expiresAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="primary"
                    onClick={handleSignOut}
                    isLoading={isSubmitting}
                    className="flex-1"
                  >
                    Sign Out
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowRawSession(!showRawSession)}
                    className="flex-1"
                  >
                    {showRawSession ? "Hide Raw Data" : "Inspect Session JSON"}
                  </Button>
                </div>
              </Card>

              {/* Dark Product Surface Chrome: Raw Session JSON */}
              {showRawSession && (
                <Card
                  variant="code-window"
                  title="session.json"
                  subtitle="Better-Auth session payload"
                >
                  <pre className="text-xs leading-relaxed text-on-dark overflow-x-auto">
                    {JSON.stringify(session, null, 2)}
                  </pre>
                </Card>
              )}
            </div>
          ) : (
            /* Logged-Out State: Editorial Tabs for Sign In & Sign Up */
            <Card variant="feature" className="p-0 overflow-hidden">
              {/* Sub-nav Category Tabs */}
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
                  /* Sign In Form */
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
                  /* Sign Up Form */
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

          {/* Footer note */}
          <p className="text-center text-xs text-muted-soft">
            Built with Better-Auth &bull; Styled with Warm-Canvas Editorial
          </p>
        </div>
      </main>
    </div>
  );
}
