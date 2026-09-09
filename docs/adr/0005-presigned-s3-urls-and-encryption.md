# 0005: Pre-Signed S3 URLs and Server-Side Encryption for Backup Artifacts

## Status
accepted

## Context and Decision
Backup bundles can be multi-gigabyte binary files. Streaming these files through the Next.js API server to the client would consume significant server memory, block Node.js event loops, and inflate egress costs.

We decided to generate short-lived (15-minute) pre-signed S3 download URLs directly to the client browser, combined with S3 standard server-side AES-256 encryption (`SSE-S3`) at rest. 

## Consequences
- The Next.js application server never handles large binary bundle downloads directly; bandwidth and transfer concurrency are fully offloaded to the S3 storage endpoint.
- Backups remain encrypted at rest while remaining compatible with direct browser downloads and standard git restoration via `git clone <bundle-file>`.
- Download links expire automatically after 15 minutes, preventing persistent public exposure of download URLs.
