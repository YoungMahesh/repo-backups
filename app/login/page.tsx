"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signIn, signUp } from "@/lib/auth-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage({
  initialMode = "signin",
}: {
  initialMode?: "signin" | "signup";
} = {}) {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = useSession();

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to /dashboard
  useEffect(() => {
    if (!isSessionPending && session?.user) {
      router.replace("/dashboard");
    }
  }, [isSessionPending, session?.user, router]);

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
        setSuccessMessage("Signed in successfully! Redirecting...");
        resetForm();
        router.push("/dashboard");
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
          error.message || "Failed to create account. Please try again.",
        );
      } else {
        setSuccessMessage("Account created successfully! Redirecting...");
        resetForm();
        router.push("/dashboard");
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

  if (isSessionPending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline border-t-primary" />
      </div>
    );
  }

  return (
    <div
      data-testid="login-page"
      className="flex min-h-screen flex-col bg-canvas text-ink selection:bg-primary/20 selection:text-ink"
    >
      {/* Header bar with brand link */}
      <header className="flex h-16 w-full items-center justify-between border-b border-hairline bg-canvas px-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-surface-card text-ink">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="text-ink"
              aria-hidden="true"
            >
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
            </svg>
          </div>
          <span className="font-serif text-lg font-medium tracking-tight text-ink">
            Repo Backups
          </span>
        </Link>

        <Link
          href="/"
          className="text-xs font-medium text-muted hover:text-ink transition-colors"
        >
          &larr; Back to Home
        </Link>
      </header>

      {/* Main Form Center */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="font-serif text-3xl font-normal tracking-tight text-ink">
              {mode === "signin" ? "Sign In to Repo Backups" : "Create an Account"}
            </h1>
            <p className="font-sans text-xs sm:text-sm text-body">
              {mode === "signin"
                ? "Enter your credentials to access repository backups and configurations."
                : "Register an account to connect your GitHub organizations."}
            </p>
          </div>

          {/* Semantic Notifications */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md border border-error/25 bg-error/10 p-3.5 text-xs text-error space-y-1"
            >
              <p className="font-semibold uppercase tracking-wider">Notice</p>
              <p>{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="rounded-md border border-success/25 bg-success/10 p-3.5 text-xs text-success space-y-1"
            >
              <p className="font-semibold uppercase tracking-wider">Success</p>
              <p>{successMessage}</p>
            </div>
          )}

          {/* Form Card */}
          <Card variant="feature" className="p-0 overflow-hidden shadow-xs">
            {/* Tabs */}
            <div className="flex border-b border-hairline bg-surface-soft/60 p-1.5 gap-1.5">
              <button
                type="button"
                data-testid="tab-signin"
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
                data-testid="tab-signup"
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
                <form
                  data-testid="signin-form"
                  onSubmit={handleSignIn}
                  className="space-y-4"
                >
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
                <form
                  data-testid="signup-form"
                  onSubmit={handleSignUp}
                  className="space-y-4"
                >
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
        </div>
      </main>
    </div>
  );
}
