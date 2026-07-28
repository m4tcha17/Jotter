# modules/capture/

`CaptureScreen.tsx` — the orchestrator/state machine for the photo-and-data capture flow: loads `capture_slots` + `fields` for the project, steps through slots in order (angle-assist → camera, per slot), then the logging form, then save.

- Behavior forks on the project's `capture_mode` only implicitly: `CaptureScreen` doesn't branch on it directly — it always steps through `fetchCaptureSlots(projectId)` in order (`single` projects have exactly one auto-created slot, so the same loop degenerates to one photo).
- `AngleAssistStep.tsx` (`expo-sensors` `DeviceMotion`, tilt/level only — no camera preview) runs before any slot with a `target_angle_degrees`.
- The actual camera hardware interaction lives in `modules/camera/` (see its `CLAUDE.md`), and the per-sample logging form lives in `modules/samples/` — this module is the thin composition layer stepping between them, not where either concern's implementation details belong.
- Writes go straight to Supabase via `modules/samples/api.ts`'s `createSample` — offline-first SQLite and the immediate-sync-on-completion trigger are still separate, unbuilt steps (`docs/current-task.md` build order steps 2 and 9).
- Full behavior spec is in `docs/architecture.md`'s Navigation Structure section — read it before changing this flow.
