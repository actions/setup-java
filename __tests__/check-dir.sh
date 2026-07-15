#!/bin/sh
# Assert whether a directory exists, for use in the e2e cache workflows.
#
# Usage: check-dir.sh <dir> [present|absent]
#
#   present (default): fail if <dir> does NOT exist, otherwise list its contents.
#   absent:            fail if <dir> DOES exist.
#
# Call with already-expanded paths (e.g. "$HOME/.gradle/caches") to avoid
# tilde-expansion pitfalls.
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: check-dir.sh <dir> [present|absent]" >&2
  exit 2
fi

dir=$1
mode=${2:-present}

case "$mode" in
  present)
    if [ ! -d "$dir" ]; then
      echo "::error::The $dir directory does not exist unexpectedly"
      exit 1
    fi
    ls "$dir"
    ;;
  absent)
    if [ -d "$dir" ]; then
      echo "::error::The $dir directory exists unexpectedly"
      exit 1
    fi
    ;;
  *)
    echo "::error::Unknown mode '$mode' (expected 'present' or 'absent')"
    exit 1
    ;;
esac
