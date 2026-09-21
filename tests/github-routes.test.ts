import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, githubInstallations, githubRepositories } from "@/db/schema";
import { auth } from "@/lib/auth";
import { signState } from "@/lib/github/crypto";
import { setMockGitHubClient } from "@/lib/github/client";
import { GET as connectHandler } from "@/app/api/github/connect/route";
import { GET as callbackHandler } from "@/app/api/github/callback/route";
import { POST as syncHandler } from "@/app/api/github/sync/route";
import { GET as installationsHandler } from "@/app/api/installations/route";
import { GET as repositoriesHandler, PATCH as updateRepositoriesHandler } from "@/app/api/repositories/route";
import { GET as singleRepositoryHandler, PATCH as updateSingleRepositoryHandler } from "@/app/api/repositories/[id]/route";
import { GET as setupStatusHandler } from "@/app/api/github/setup-status/route";

describe("GitHub High-Level Route Handlers", () => {
  const TEST_USER_ID = "route-test-user-1";
  const TEST_INSTALLATION_ID = 987654321;

  beforeAll(async () => {
    // Ensure test user exists in database for FK references
    await db
      .insert(user)
      .values({
        id: TEST_USER_ID,
        name: "Route Test User",
        email: "routetest@example.com",
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(githubInstallations)
      .where(eq(githubInstallations.userId, TEST_USER_ID));
    await db.delete(user).where(eq(user.id, TEST_USER_ID));
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    setMockGitHubClient({
      installation: {
        id: TEST_INSTALLATION_ID,
        account: {
          login: "octo-org",
          type: "Organization",
          avatar_url: "https://avatars.githubusercontent.com/u/12345?v=4",
        },
        target_type: "selected",
        repository_selection: "selected",
      },
      repositories: [
        {
          id: 5001,
          name: "web-app",
          full_name: "octo-org/web-app",
          private: true,
          default_branch: "main",
          owner: {
            login: "octo-org",
            avatar_url: "https://avatars.githubusercontent.com/u/12345?v=4",
            type: "Organization",
          },
        },
        {
          id: 5002,
          name: "docs",
          full_name: "octo-org/docs",
          private: false,
          default_branch: "master",
          owner: {
            login: "octo-org",
            avatar_url: "https://avatars.githubusercontent.com/u/12345?v=4",
            type: "Organization",
          },
        },
      ],
    });
  });

  describe("GET /api/github/connect", () => {
    it("returns 401 when user is unauthenticated", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/github/connect?format=json");
      const res = await connectHandler(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Authentication required");
    });

    it("returns JSON with signed state and GitHub App installation URL when authenticated", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        user: {
          id: TEST_USER_ID,
          email: "routetest@example.com",
          name: "Route Test User",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-1",
          userId: TEST_USER_ID,
          expiresAt: new Date(),
          token: "token-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const req = new NextRequest("http://localhost:3000/api/github/connect?format=json");
      const res = await connectHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toContain("https://github.com/apps/");
      expect(data.url).toContain("installations/new?state=");
      expect(data.state).toBeDefined();
    });
  });

  describe("GET /api/github/setup-status", () => {
    it("returns setup configuration status and metadata", async () => {
      const res = await setupStatusHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data.isConfigured).toBe("boolean");
      expect(Array.isArray(data.missing)).toBe(true);
      expect(data.callbackPath).toBe("/api/github/callback");
      expect(data.webhookPath).toBe("/api/github/webhook");
      expect(Array.isArray(data.permissions)).toBe(true);
      expect(data.permissions.some((p: { resource: string; access: string }) => p.resource === "Contents" && p.access === "read")).toBe(true);
      expect(data.permissions.some((p: { resource: string; access: string }) => p.resource === "Metadata" && p.access === "read")).toBe(true);
    });
  });


  describe("GET /api/github/callback", () => {
    it("rejects invalid state parameter with 400", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=invalid.signature&format=json`,
      );
      const res = await callbackHandler(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid state signature");
    });

    it("links installation and synchronizes repositories with valid signed state", async () => {
      const validState = signState(TEST_USER_ID);
      const req = new NextRequest(
        `http://localhost:3000/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${validState}&format=json`,
      );
      const res = await callbackHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.repositoriesCount).toBe(2);
      expect(data.installation.accountLogin).toBe("octo-org");
      expect(data.installation.userId).toBe(TEST_USER_ID);

      // Verify database record persisted
      const savedInstallations = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.userId, TEST_USER_ID));
      expect(savedInstallations.length).toBe(1);
      expect(savedInstallations[0].accountLogin).toBe("octo-org");

      // Verify repositories persisted
      const savedRepos = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.userId, TEST_USER_ID));
      expect(savedRepos.length).toBe(2);
      expect(savedRepos.map((r) => r.name)).toContain("web-app");
      expect(savedRepos.map((r) => r.name)).toContain("docs");
    });

    it("redirects to forwarded host from proxy when not requesting JSON", async () => {
      const validState = signState(TEST_USER_ID);
      const req = new NextRequest(
        `http://0.0.0.0:3000/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${validState}`,
        {
          headers: {
            "x-forwarded-host": "repo-manage.example.com",
            "x-forwarded-proto": "https",
          },
        },
      );
      const res = await callbackHandler(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toBe(
        "https://repo-manage.example.com/?connected=success&org=octo-org",
      );
    });

    it("redirects errors to forwarded host without 0.0.0.0", async () => {
      const req = new NextRequest(
        "http://0.0.0.0:3000/api/github/callback?installation_id=invalid&state=invalid",
        {
          headers: {
            "x-forwarded-host": "repo-manage.example.com",
            "x-forwarded-proto": "https",
          },
        },
      );
      const res = await callbackHandler(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("https://repo-manage.example.com/?error=");
      expect(location).not.toContain("0.0.0.0");
    });
  });

  describe("POST /api/github/sync", () => {
    it("returns 401 when user is unauthenticated", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/github/sync", {
        method: "POST",
        body: JSON.stringify({ installationId: TEST_INSTALLATION_ID }),
      });
      const res = await syncHandler(req);

      expect(res.status).toBe(401);
    });

    it("synchronizes and refreshes repository inventory for authenticated user", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        user: {
          id: TEST_USER_ID,
          email: "routetest@example.com",
          name: "Route Test User",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-1",
          userId: TEST_USER_ID,
          expiresAt: new Date(),
          token: "token-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Update mock to return 3 repos instead of 2
      setMockGitHubClient({
        repositories: [
          {
            id: 5001,
            name: "web-app",
            full_name: "octo-org/web-app",
            private: true,
            default_branch: "main",
            owner: {
              login: "octo-org",
              avatar_url: "https://avatars.githubusercontent.com/u/12345?v=4",
              type: "Organization",
            },
          },
          {
            id: 5002,
            name: "docs",
            full_name: "octo-org/docs",
            private: false,
            default_branch: "master",
            owner: {
              login: "octo-org",
              avatar_url: "https://avatars.githubusercontent.com/u/12345?v=4",
              type: "Organization",
            },
          },
          {
            id: 5003,
            name: "backend-api",
            full_name: "octo-org/backend-api",
            private: true,
            default_branch: "main",
            owner: {
              login: "octo-org",
              avatar_url: "https://avatars.githubusercontent.com/u/12345?v=4",
              type: "Organization",
            },
          },
        ],
      });

      const req = new NextRequest("http://localhost:3000/api/github/sync", {
        method: "POST",
        body: JSON.stringify({ installationId: TEST_INSTALLATION_ID }),
      });
      const res = await syncHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(3);

      // Verify 3 repositories now in DB
      const updatedRepos = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.userId, TEST_USER_ID));
      expect(updatedRepos.length).toBe(3);
    });
  });

  describe("GET /api/installations & GET /api/repositories", () => {
    beforeEach(() => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        user: {
          id: TEST_USER_ID,
          email: "routetest@example.com",
          name: "Route Test User",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-1",
          userId: TEST_USER_ID,
          expiresAt: new Date(),
          token: "token-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    it("GET /api/installations lists user installations with repo counts", async () => {
      const req = new NextRequest("http://localhost:3000/api/installations");
      const res = await installationsHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.installations).toBeDefined();
      expect(data.installations.length).toBe(1);
      expect(data.installations[0].accountLogin).toBe("octo-org");
      expect(data.installations[0].repositoryCount).toBe(3);
    });

    it("GET /api/repositories lists authorized repositories with details", async () => {
      const req = new NextRequest("http://localhost:3000/api/repositories");
      const res = await repositoriesHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.repositories).toBeDefined();
      expect(data.repositories.length).toBe(3);
      expect(data.repositories[0].name).toBeDefined();
      expect(data.repositories[0].defaultBranch).toBeDefined();
    });
  });

  describe("PATCH /api/repositories/[id] & PATCH /api/repositories", () => {
    let testRepoId: string;

    beforeEach(async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        user: {
          id: TEST_USER_ID,
          email: "routetest@example.com",
          name: "Route Test User",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-1",
          userId: TEST_USER_ID,
          expiresAt: new Date(),
          token: "token-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const repos = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.userId, TEST_USER_ID));
      if (repos.length > 0) {
        testRepoId = repos[0].id;
      }
    });

    it("returns 401 when user is unauthenticated", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/repositories/${testRepoId}`, {
        method: "PATCH",
        body: JSON.stringify({ backupEnabled: true }),
      });
      const res = await updateSingleRepositoryHandler(req, {
        params: Promise.resolve({ id: testRepoId }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 404 when repository does not exist or belongs to another user", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/repositories/non-existent-id",
        {
          method: "PATCH",
          body: JSON.stringify({ backupEnabled: true }),
        },
      );
      const res = await updateSingleRepositoryHandler(req, {
        params: Promise.resolve({ id: "non-existent-id" }),
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain("Repository not found");
    });

    it("returns 400 when invalid backupSchedule value is provided", async () => {
      const req = new NextRequest(`http://localhost:3000/api/repositories/${testRepoId}`, {
        method: "PATCH",
        body: JSON.stringify({ backupSchedule: "hourly" }),
      });
      const res = await updateSingleRepositoryHandler(req, {
        params: Promise.resolve({ id: testRepoId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid backupSchedule");
    });

    it("persists backupEnabled toggled to true", async () => {
      const req = new NextRequest(`http://localhost:3000/api/repositories/${testRepoId}`, {
        method: "PATCH",
        body: JSON.stringify({ backupEnabled: true }),
      });
      const res = await updateSingleRepositoryHandler(req, {
        params: Promise.resolve({ id: testRepoId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.repository.backupEnabled).toBe(true);

      // Verify in DB
      const [updated] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.id, testRepoId));
      expect(updated.backupEnabled).toBe(true);
    });

    it("persists backupSchedule changed to weekly", async () => {
      const req = new NextRequest(`http://localhost:3000/api/repositories/${testRepoId}`, {
        method: "PATCH",
        body: JSON.stringify({ backupSchedule: "weekly" }),
      });
      const res = await updateSingleRepositoryHandler(req, {
        params: Promise.resolve({ id: testRepoId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.repository.backupSchedule).toBe("weekly");

      // Verify in DB
      const [updated] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.id, testRepoId));
      expect(updated.backupSchedule).toBe("weekly");
    });

    it("disabling backup retains existing repository history and marks repository inactive", async () => {
      const pastBackupDate = new Date("2026-09-01T12:00:00Z");
      // Set backup history on the repository
      await db
        .update(githubRepositories)
        .set({
          backupEnabled: true,
          lastBackupAt: pastBackupDate,
          lastBackupStatus: "success",
        })
        .where(eq(githubRepositories.id, testRepoId));

      const req = new NextRequest(`http://localhost:3000/api/repositories/${testRepoId}`, {
        method: "PATCH",
        body: JSON.stringify({ backupEnabled: false }),
      });
      const res = await updateSingleRepositoryHandler(req, {
        params: Promise.resolve({ id: testRepoId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.repository.backupEnabled).toBe(false);

      // Verify in DB that history is preserved
      const [updated] = await db
        .select()
        .from(githubRepositories)
        .where(eq(githubRepositories.id, testRepoId));
      expect(updated.backupEnabled).toBe(false);
      expect(updated.lastBackupAt).toBeDefined();
      expect(updated.lastBackupStatus).toBe("success");
    });

    it("PATCH /api/repositories also updates repository configuration with id in body", async () => {
      const req = new NextRequest("http://localhost:3000/api/repositories", {
        method: "PATCH",
        body: JSON.stringify({
          id: testRepoId,
          backupEnabled: true,
          backupSchedule: "manual",
        }),
      });
      const res = await updateRepositoriesHandler(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.repository.backupSchedule).toBe("manual");
      expect(data.repository.backupEnabled).toBe(true);
    });

    it("GET /api/repositories/[id] fetches single repository for authenticated user", async () => {
      const req = new NextRequest(`http://localhost:3000/api/repositories/${testRepoId}`);
      const res = await singleRepositoryHandler(req, {
        params: Promise.resolve({ id: testRepoId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.repository).toBeDefined();
      expect(data.repository.id).toBe(testRepoId);
    });
  });
});
