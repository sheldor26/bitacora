#!/usr/bin/env bash
# bitacora — session start.
#
# Injects the smallest useful slice of memory into a cold session: what is in
# flight, what is next, and which areas have burned us most. Everything else
# stays on disk until the agent asks for it by tag.
#
# Deliberately cheap: a few hundred tokens, not a few thousand.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -f STATE.md ] || exit 0

echo "## Logbook digest"
echo

# The two sections a cold session actually needs.
awk '
  /^## (In flight|Next)/ { show = 1; print; next }
  /^## / { show = 0 }
  show { print }
' STATE.md | grep -v 'bitacora:fill-me' | sed '/^$/N;/^\n$/D'

updated=$(grep -m1 '^updated:' STATE.md | awk '{print $2}')
if [ -n "${updated:-}" ]; then
  echo
  echo "_STATE.md last updated: ${updated}._"
fi

if [ -f .bitacora/cli.mjs ] && command -v node >/dev/null 2>&1; then
  top=$(NO_COLOR=1 node .bitacora/cli.mjs stats 2>/dev/null \
        | awk '/█/ {print $1}' | head -4 | paste -sd, - | sed 's/,/, /g')
  if [ -n "${top:-}" ]; then
    echo
    echo "Most-logged areas: ${top}."
    echo "Before touching one of them, run \`node .bitacora/cli.mjs recall <tag>\`."
  fi
fi

exit 0
