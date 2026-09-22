#!/usr/bin/env bash
# Steady, realistic traffic -- the baseline "does this behave
# correctly under normal load" check. See test/README.md.
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_run-k6.sh" load-test.js "$@"
