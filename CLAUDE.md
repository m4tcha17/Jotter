@AGENTS.md

## Stack
Expo, React Native, Supabase, TypeScript

## Rules
- Read docs/architecture.md before making changes
- Read docs/current-task.md to know what to build
- Don't over-engineer. Match existing code style
- Don't add comments unless logic is genuinely non-obvious
- Ask before touching files outside the current task scope
- Never touch sensitive files (e.g. .env, .env.*, credentials, keys) — do not read, edit, print, or move them


## Skills

Reach for these before doing the work by hand — check first, don't skip:
- **context7-mcp**: any Expo, Supabase, React Navigation, or nativewind API/config question. Cross-check against AGENTS.md's SDK 56 versioned-docs note — context7's Expo index may lag behind the pinned SDK.
- **supabase**: any Supabase task — Auth (incl. anonymous guest accounts), RLS policies, migrations, CLI, client usage.
- **supabase-postgres-best-practices**: schema or query changes touching Postgres — `entry_values` EAV model, `project_members` RLS, indexes.
- **impeccable**: any screen/UI work — design audits, palette/spacing/hierarchy fixes, new screens.
- **engineering-skills:senior-qa**: writing or auditing tests for screens/components — this repo has known coverage gaps.
- CodeGraph (`.codegraph/`) is already covered by global instructions — reach for `codegraph_explore` before grep/Read in this repo.

## Directory-level context

Source directories carry their own CLAUDE.md scoped to what that directory actually does — read the one for wherever you're working, in addition to this file: `modules/` (plus one per domain subdirectory: `auth/`, `account/`, `projects/`, `fields/`, `capture/`, `camera/`, `samples/`, `data/`), `navigation/`, `lib/`, `docs/`. See `docs/architecture.md`'s Project Structure section for the full tree. This file holds only what's true everywhere — anything specific to one module, flow, or layer belongs in that directory's own CLAUDE.md instead.

## Current task

No active task yet — see docs/current-task.md.
