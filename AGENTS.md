# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# What DataSnap is

A mobile app for capturing photos and logging structured data against them, organized into projects with a fully user-customizable field schema and bundled CSV export, built for field researchers unfamiliar with technology. Framed as a general-purpose data-collection tool — never mention "thesis" in code, comments, UI copy, or commit messages.

# Key architecture decisions

Full design lives in docs/architecture.md. Load-bearing decisions any agent must respect before touching code:
- Offline-first: expo-sqlite is the source of truth; Supabase sync is best-effort, never a hard dependency for core flows.
- Fields, categories, and entries are project-scoped — never assume a single global schema for the whole app.
- Fields are fully dynamic (EAV model via `entry_values`) — never hardcode columns for user-defined fields.
- Projects are private by default with opt-in per-project sharing via `project_members` — RLS must check project ownership or accepted membership, never a blanket "all authenticated users" policy.
- Guest accounts are real Supabase anonymous-auth users, not a separate local-only code path.
- Photo capture uses a custom native camera module for locked manual exposure (ISO/shutter/white-balance) — never assume `expo-camera`'s stock API can do this (it can't); this also requires the target device to support Camera2 hardware level `LIMITED` or better.
