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

## Directory-level context

Source directories carry their own CLAUDE.md scoped to what that directory actually does — read the one for wherever you're working, in addition to this file: `screens/` (plus one per use-case subdirectory: `auth/`, `account/`, `projects/`, `capture/`, `fields/`, `data/`), `components/`, `navigation/`, `lib/`, `docs/`. See `docs/architecture.md`'s Project Structure section for the full tree. This file holds only what's true everywhere — anything specific to one screen, flow, or layer belongs in that directory's own CLAUDE.md instead.

## Current task

No active task yet — see docs/current-task.md.
