## graphify

This project has a graphify knowledge graph at .graphify/.

Rules:
- For codebase or architecture questions, when `.graphify/graph.json` exists, first run `graphify query "<question>"` (or `graphify path "<A>" "<B>"` / `graphify explain "<concept>"`); these return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output
- If .graphify/wiki/index.md exists, navigate it instead of reading raw files
- If .graphify/graph.json is missing but graphify-out/graph.json exists, run `graphify migrate-state --dry-run` first; if tracked legacy artifacts are reported, ask before using the recommended `git mv -f graphify-out .graphify` and commit message
- If .graphify/needs_update exists or .graphify/branch.json has stale=true, warn before relying on semantic results and run /graphify . --update when appropriate
- Before proposing or committing .graphify artifacts, run `graphify portable-check .graphify`; commit-safe graph artifacts must use repo-relative paths, and never commit .graphify/branch.json, .graphify/worktree.json, .graphify/needs_update, or .graphify/cache/. If a repo already tracks any of them, first add them to .gitignore, then propose `git rm --cached .graphify/branch.json .graphify/worktree.json .graphify/needs_update` and `git rm -r --cached .graphify/cache`; never mutate git state without asking
- Before deep graph traversal, prefer `graphify summary --graph .graphify/graph.json` for compact first-hop orientation
- For review impact on changed files, use `graphify review-delta --graph .graphify/graph.json` instead of generic traversal
- Read `.graphify/GRAPH_REPORT.md` only for broad architecture review or when `query` / `path` / `explain` do not surface enough context
- Do not run `graphify hook-rebuild` by hand — this project rebuilds the graph automatically (see below)

## graphify — how it stays current here

The graph is rebuilt for you; nothing about it needs to be run manually.

- **End of every Claude Code turn** — the `Stop` hook in `.claude/settings.json` runs
  `.claude/hooks/graphify-rebuild.sh`. It exits immediately unless a file under
  `src/`, `scripts/`, `docs/` or a root config file is newer than `.graphify/graph.json`,
  and otherwise detaches the ~25s rebuild into the background under a lock.
- **After `git commit` / `checkout` / `merge` / `rebase`** — the hooks from
  `graphify hook install` mark the graph stale and rebuild it in the background.
- **Live, while editing outside a session** — `pnpm graph:watch` (3s debounce).
- **One-shot, blocking** — `pnpm graph`.

`.graphify/` is gitignored: `manifest.json` stores absolute paths, so the artifacts are
not portable between checkouts. A fresh clone gets its graph from the first `pnpm graph`.

The AST layer (nodes, edges, communities) is complete. Node descriptions and community
names are not: `graphify update` left 37 batches in `.graphify/description-instructions/`
and `.graphify/label-instructions/` waiting for an LLM pass. Queries work without them —
they just return file and symbol names rather than prose.
