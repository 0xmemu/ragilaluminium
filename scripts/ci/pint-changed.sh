#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
  git fetch --no-tags --depth=1 origin "${GITHUB_BASE_REF}"
  comparison="origin/${GITHUB_BASE_REF}...HEAD"
elif git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  comparison="HEAD^...HEAD"
else
  echo "No comparison commit; skipping changed-file Pint gate."
  exit 0
fi

mapfile -t php_files < <(git diff --name-only --diff-filter=ACMRT "${comparison}" -- '*.php')

if (( ${#php_files[@]} == 0 )); then
  echo "No changed PHP files."
  exit 0
fi

printf 'Pint checking %s changed PHP file(s).\n' "${#php_files[@]}"
vendor/bin/pint --test "${php_files[@]}"
