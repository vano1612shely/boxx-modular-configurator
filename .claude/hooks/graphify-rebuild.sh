#!/bin/sh
# Rebuilds the graphify code graph after a session touches source files.
# Wired to the Stop hook in .claude/settings.json; git commits/checkouts are
# covered separately by the hooks from `graphify hook install`.
#
# Never blocks: bails out early when there is nothing to do and otherwise
# detaches the rebuild (~25s on this repo) into the background.

ROOT="${CLAUDE_PROJECT_DIR:-.}"
cd "$ROOT" 2>/dev/null || exit 0

GRAPH=".graphify/graph.json"
[ -f "$GRAPH" ] || exit 0

CACHE=".graphify/cache"
LOCK="$CACHE/.rebuild.lock"
LOG="$CACHE/rebuild.log"
mkdir -p "$CACHE"

# Drop a lock left behind by a killed rebuild.
find "$CACHE" -name .rebuild.lock -mmin +15 -delete 2>/dev/null
[ -f "$LOCK" ] && exit 0

# Nothing to do unless a source file is newer than the graph itself.
CHANGED=$(find src scripts docs -type f \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
       -o -name '*.mjs' -o -name '*.mts' -o -name '*.scss' -o -name '*.md' \) \
    -newer "$GRAPH" -print 2>/dev/null | head -n 1)
if [ -z "$CHANGED" ]; then
    for f in next.config.ts eslint.config.mjs postcss.config.mjs vitest.config.mts package.json; do
        [ "$f" -nt "$GRAPH" ] && CHANGED="$f" && break
    done
fi
[ -z "$CHANGED" ] && exit 0

if command -v graphify >/dev/null 2>&1; then
    CMD="graphify"
elif command -v npx >/dev/null 2>&1; then
    CMD="npx graphify"
else
    exit 0
fi

: > "$LOCK"
if command -v nohup >/dev/null 2>&1; then
    nohup sh -c "$CMD hook-rebuild; rm -f '$LOCK'" > "$LOG" 2>&1 < /dev/null &
else
    sh -c "$CMD hook-rebuild; rm -f '$LOCK'" > "$LOG" 2>&1 < /dev/null &
fi
disown 2>/dev/null || true
exit 0
