import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";

const mockReplace = vi.fn();
const mockPush = vi.fn();
const mockUseSession = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => mockUseSession(),
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
}));

// Import after mocks are established
import LoginPage from "@/app/login/page";
import DashboardPage from "@/app/dashboard/page";

describe("Route Separation & Authentication UI (Spec: Route Separation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LoginPage Component", () => {
    it("renders sign in form by default with email and password inputs", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
        error: null,
      });

      const html = renderToString(<LoginPage initialMode="signin" />);

      expect(html).toContain("data-testid=\"login-page\"");
      expect(html).toContain("data-testid=\"signin-form\"");
      expect(html).toContain("Sign In to Repo Manage");
      expect(html).toContain("id=\"signin-email\"");
      expect(html).toContain("id=\"signin-password\"");
      expect(html).not.toContain("id=\"signup-name\"");
      expect(html).toContain("Create one now");
    });

    it("renders create account form when initialMode is signup", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
        error: null,
      });

      const html = renderToString(<LoginPage initialMode="signup" />);

      expect(html).toContain("data-testid=\"login-page\"");
      expect(html).toContain("data-testid=\"signup-form\"");
      expect(html).toContain("Create an Account");
      expect(html).toContain("id=\"signup-name\"");
      expect(html).toContain("id=\"signup-email\"");
      expect(html).toContain("id=\"signup-password\"");
      expect(html).toContain("Already have an account?");
    });

    it("renders loading spinner while session resolution is pending", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: true,
        error: null,
      });

      const html = renderToString(<LoginPage />);

      expect(html).toContain("animate-spin");
    });
  });

  describe("DashboardPage Component Route Protection", () => {
    it("renders pulse loading skeleton when session is pending", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: true,
        error: null,
      });

      const html = renderToString(<DashboardPage />);

      expect(html).toContain("animate-pulse");
      expect(html).not.toContain("Repository Backup Dashboard");
    });

    it("returns empty/null markup if session has no user", () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
        error: null,
      });

      const html = renderToString(<DashboardPage />);

      // Unauthenticated state returns null to prevent flashing protected UI
      expect(html).toBe("");
    });

    it("renders dashboard UI when user session is active", () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "user-test-1",
            name: "Platform Engineer",
            email: "engineer@company.com",
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          session: {
            id: "session-1",
            userId: "user-test-1",
            token: "tok-123",
            expiresAt: new Date(Date.now() + 86400000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        isPending: false,
        error: null,
      });

      const html = renderToString(<DashboardPage />);

      expect(html).toContain("data-testid=\"dashboard-page\"");
      expect(html).toContain("Repository Backup Dashboard");
      expect(html).toContain("Connect your GitHub Organization");
      expect(html).toContain("engineer@company.com");
      expect(html).toContain("Platform Engineer");
      expect(html).toContain("Sign Out");
    });
  });
});
