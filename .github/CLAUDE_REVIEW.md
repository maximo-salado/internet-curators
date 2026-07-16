# Pre-Commit Claude Review Convention

Before merging any PR to main, Claude Sonnet reviews the diff.

## Trigger
When Max says "commit" or "merge" on the Internet Curators project.

## Steps
1. PR is open from develop → main
2. Hermes runs: `claude -p "Review this PR diff for bugs, security, perf, and code quality" --model sonnet --max-turns 5`
3. Claude flags issues → fixes applied → re-review → merge
4. Max must approve merge (no auto-merge)

## Why
Claude catches what OpenCode misses. Different models, different blind spots. The audit proved this — 26 real issues in code that compiled clean.
