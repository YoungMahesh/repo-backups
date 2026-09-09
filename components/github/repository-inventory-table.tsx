"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface RepositoryItem {
  id: string;
  installationId: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  backupEnabled: boolean;
  backupSchedule: string;
  lastBackupAt?: string | Date | null;
  lastBackupStatus?: string | null;
  accountLogin?: string;
  createdAt?: string | Date;
}

interface RepositoryInventoryTableProps {
  repositories: RepositoryItem[];
  isLoading?: boolean;
}

export function RepositoryInventoryTable({
  repositories,
  isLoading = false,
}: RepositoryInventoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRepositories = useMemo(() => {
    if (!searchQuery.trim()) return repositories;
    const query = searchQuery.toLowerCase();
    return repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) ||
        repo.fullName.toLowerCase().includes(query),
    );
  }, [repositories, searchQuery]);

  return (
    <div
      className="space-y-4 rounded-lg border border-hairline bg-canvas p-6 shadow-xs"
      data-testid="repository-inventory"
    >
      {/* Table Header & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-hairline">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg sm:text-xl font-normal text-ink">
              Authorized Repositories
            </h3>
            <Badge variant="pill">{repositories.length}</Badge>
          </div>
          <p className="font-sans text-xs text-muted mt-0.5">
            Repositories authorized for read-only backup via GitHub App installation
          </p>
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted space-y-3">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-primary" />
          <p>Loading repository inventory...</p>
        </div>
      ) : filteredRepositories.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted space-y-2">
          {searchQuery ? (
            <>
              <p className="font-medium text-body">No matching repositories found</p>
              <p>Try refining your search query &quot;{searchQuery}&quot;</p>
            </>
          ) : (
            <>
              <p className="font-medium text-body">No repositories authorized yet</p>
              <p>
                Configure repository access in your GitHub App installation to inventory codebases.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-soft/40">
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                  Repository
                </th>
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                  Privacy
                </th>
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted">
                  Default Branch
                </th>
                <th className="py-2.5 px-4 font-sans text-xs font-medium uppercase tracking-wider text-muted text-right">
                  Access
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filteredRepositories.map((repo) => {
                const parts = repo.fullName.split("/");
                const orgPrefix = parts.length > 1 ? parts[0] : repo.accountLogin;
                const repoName = parts.length > 1 ? parts[1] : repo.name;

                return (
                  <tr
                    key={repo.id}
                    className="hover:bg-surface-soft/30 transition-colors"
                    data-testid={`repo-row-${repo.name}`}
                  >
                    {/* Repository Name with Org Prefix */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 shrink-0 text-muted"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 0 .5h-6.5a.25.25 0 0 1-.25-.25Z" />
                        </svg>
                        <div className="truncate">
                          {orgPrefix && (
                            <span className="font-sans text-xs text-muted">
                              {orgPrefix} /{" "}
                            </span>
                          )}
                          <span className="font-sans text-sm font-semibold text-ink">
                            {repoName}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Privacy Status Badge */}
                    <td className="py-3 px-4">
                      {repo.isPrivate ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-cream-strong/60 px-2.5 py-0.5 text-xs font-medium text-ink">
                          <svg
                            className="h-3 w-3 text-muted"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 4v2h-.25A1.75 1.75 0 0 0 2 7.75v5.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0 0 14 13.25v-5.5A1.75 1.75 0 0 0 12.25 6H12V4a4 4 0 0 0-8 0Zm6.5 2V4a2.5 2.5 0 0 0-5 0v2h5Z"
                            />
                          </svg>
                          Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-hairline/60 bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-muted">
                          Public
                        </span>
                      )}
                    </td>

                    {/* Default Branch */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-body">
                        <svg
                          className="h-3.5 w-3.5 text-muted"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 6a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM3.5 4a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                        </svg>
                        <span>{repo.defaultBranch}</span>
                      </div>
                    </td>

                    {/* Access Level */}
                    <td className="py-3 px-4 text-right">
                      <span className="font-sans text-xs text-muted">Read-Only</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
