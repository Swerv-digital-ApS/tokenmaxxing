#!/usr/bin/env bash
# Compatibility entry point for existing macOS workflows and local scripts.
set -euo pipefail
exec bun "$(dirname "$0")/helper.ts"
