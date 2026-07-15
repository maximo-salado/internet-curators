# Agent Attribution Convention

Every commit and PR on this project is co-created with AI agents. We note which agents were involved directly in the commit message.

## Commit Format

```
<type>: <description>

Agent: <agents>
Review: <agent> (optional)
```

## Agents

| Role | Agent |
|------|-------|
| Orchestration | hermes |
| Code | opencode |
| Audit | claude |

## Examples

```bash
git commit -m "feat: Discover/Feed pipeline

Agent: hermes + opencode
Review: claude"

git commit -m "ci: add build check workflow

Agent: hermes"

git commit -m "fix: security audit — RLS, SSRF, vote inflation

Agent: claude"
```

## PR Format

```markdown
## Agent Stack
- **Orchestration:** hermes
- **Code:** opencode
- **Review:** claude
```

## Why

This project is a portfolio piece demonstrating AI-augmented solo development. Hiding the AI involvement would misrepresent the process. The goal isn't to pretend AI did the work — it's to show how a designer uses AI as a force multiplier to ship production code.
