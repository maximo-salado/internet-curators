# Agent Attribution Convention

Every commit and PR on this project is co-created with AI agents. We note which agents were involved directly in the commit message.

## Commit Format

```
<type>: <description>

<role>: <agent>
```

## Agents

| Role | Agent |
|------|-------|
| orchestration | hermes |
| code | opencode |
| review | claude |

## Examples

```bash
git commit -m "feat: Discover/Feed pipeline

orchestration: hermes
code: opencode
review: claude"

git commit -m "ci: add build check workflow

orchestration: hermes"

git commit -m "fix: security audit — RLS, SSRF, vote inflation

code: claude
review: claude"
```

## PR Format

```markdown
## Agent Stack
- **orchestration:** hermes
- **code:** opencode
- **review:** claude
```

## Why

This project is a portfolio piece demonstrating AI-augmented solo development. Hiding the AI involvement would misrepresent the process. The goal isn't to pretend AI did the work — it's to show how a designer uses AI as a force multiplier to ship production code.
