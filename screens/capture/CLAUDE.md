# screens/capture/

`CaptureScreen.tsx` — currently a placeholder. The real flow is blocked on a custom native Android camera module (Kotlin, `Camera2Interop`) for locked manual exposure (ISO/shutter/white-balance).

- Don't implement capture against `expo-camera`'s stock API as a stand-in for locked exposure — it has no ISO/shutter/white-balance controls (verified against the SDK 56 docs; only `zoom`/`flash`/`enableTorch`/`autofocus`/`active` are exposed). If you need to ship an interim placeholder, keep it explicitly labeled as one.
- Only works on devices reporting Camera2 hardware level `LIMITED` or better — this is a hard hardware ceiling, not a software gap to work around.
- Behavior forks on the project's `capture_mode`: `single` is a one-slot case of the same underlying flow; `multi` steps through `capture_slots` in order, with an angle-assist screen (`expo-sensors`, tilt/level only — no camera preview) before any slot that has a `target_angle_degrees`.
- Once every slot for the sample has a photo, the shared per-sample logging form appears — `timestamp` fields are skipped (auto-written at save), `is_required` fields hard-block save, and the project's `is_sample_identifier` field (if any) is checked against existing values and warns (non-blocking) on a match. Full behavior is in `docs/architecture.md`'s Navigation Structure section — read it before changing this flow.
