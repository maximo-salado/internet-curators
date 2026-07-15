# Agent Attribution Convention

Every commit and PR on this project is co-created with AI agents. We use `Co-authored-by:` trailers for transparency.

## Commit Format

```
<type>: <description>

Agent: <role> — <model>
Co-authored-by: <name> <<email>>
```

## Agents

| Role | Name | Email | Model |
|------|------|-------|-------|
| Orchestration | Hermes | hermes@nousresearch.com | deepseek-v4-pro |
| Code | OpenCode | opencode@opencode.ai | opencode-go/deepseek-v4-flash |
| Audit | Claude | claude@anthropic.com | claude-sonnet-4 |

## Examples

```bash
git commit -m "feat: Discover/Feed pipeline

Agent: hermes + opencode-go/deepseek-v4-flash
Review: claude-sonnet-4
Co-authored-by: Hermes <hermes@nousresearch.com>
Co-authored-by: OpenCode <opencode@opencode.ai>
Co-authored-by: Claude <claude@anthropic.com>"
```

## PR Format

```markdown
## Agent Stack
- **Orchestration:** Hermes (deepseek-v4-pro)
- **Code:** OpenCode (opencode-go/deepseek-v4-flash)
- **Review:** Claude (claude-sonnet-4)
```

## Why

This project is a portfolio piece demonstrating AI-augmented solo development. Hiding the AI involvement would misrepresent the process. The goal isn't to pretend AI did the work — it's to show how a designer uses AI as a force multiplier to ship production code.
