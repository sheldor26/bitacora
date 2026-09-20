#!/usr/bin/env bash
# bitacora — session end.
#
# The habit is the hard part, so the close is checked rather than trusted.
# Never blocks: it reports, and the agent decides what to do about it.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f bitacora.config.json ] || exit 0

problems=()

if [ -f STATE.md ]; then
  updated=$(grep -m1 '^updated:' STATE.md | awk '{print $2}')
  if [ "${updated:-}" != "$(date +%F)" ]; then
    problems+=("STATE.md still says \`updated: ${updated:-none}\`. If anything changed this session, update it and set today's date.")
  fi
fi

if command -v node >/dev/null 2>&1 && [ -f .bitacora/cli.mjs ]; then
  if ! out=$(NO_COLOR=1 node .bitacora/cli.mjs doctor 2>&1); then
    problems+=("\`doctor\` is failing:")
    problems+=("$(echo "$out" | sed 's/^/    /')")
  fi
fi

if [ ${#problems[@]} -gt 0 ]; then
  echo "## Before this session closes"
  echo
  for p in "${problems[@]}"; do echo "- $p"; done
  echo
  echo "Also worth a moment: did anything break, or work surprisingly well?"
  echo "If so, log it now — \`node .bitacora/cli.mjs new mistake|learning \"...\" --tags <area>\`."
fi

exit 0
