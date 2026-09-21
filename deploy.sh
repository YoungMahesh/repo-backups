#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

export TAG=$(git rev-parse HEAD | cut -c1-4)
echo "Using image: repo-manage:$TAG"

exec docker compose up -d
