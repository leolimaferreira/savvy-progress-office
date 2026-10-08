# savvy-progress (office edition)

A Claude Code mod: an **office** seen from above, where the main session is the boss at the big desk and each subagent works at its own desk, plus a minimal progress band above the prompt.

Based on [savvy-progress](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) by johnnyvizz (MIT).

- **Office** (`/agents-info` toggles it): a score strip on top (cost, tokens and time; total, boss and team), the boss's desk with the current prompt, a desk per subagent typing with a balloon of its task and progress, finished agents having coffee in the pantry with a ✓ on their desk, planned tasks as empty desks. Chair color is the model: Opus violet, Sonnet blue, Haiku green, Fable amber. Floors are added as the team grows. Light and dark themes; `prefers-reduced-motion` stops the animation.
- **Main session counted**: tokens, cost, context and active time of the main conversation, not only the subagents.
- **Band above the prompt**: title, phase, progress and cost, and a button that opens the office. It shows for the main session alone too.
- **Languages**: `auto` (default), `en`, `pt`, `ru`.

Cost is an estimate from token counts and a built-in price table (`PRICES` in `hooks/register.tsx`), not a bill.

## Use it locally

Clone it and name the folder in `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/savvy-progress" } }
```

## Use it in cloud sessions

Cloud sessions do not see your machine's settings, so configure the cloud environment at [claude.ai/code](https://claude.ai/code):

**Setup script**

```bash
#!/bin/bash
git clone --depth 1 https://github.com/leolimaferreira/savvy-progress-office.git ~/.claude/mods/savvy-progress || true
```

**Environment variables**

```
CLAUDE_CODE_PLUGIN_DIRS=~/.claude/mods/savvy-progress
```

The language follows the session's locale; to pin it, set `pluginConfigs` in a settings file the session reads, for example the repository's `.claude/settings.json`:

```json
{ "pluginConfigs": { "savvy-progress": { "options": { "language": "pt" } } } }
```
