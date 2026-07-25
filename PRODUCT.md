# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Field researchers who are not comfortable with technology. They physically handle and position samples (e.g. on a copy stand or rig) while operating the phone one-handed, in field conditions where connectivity is often poor or absent. Their job: capture a photo (or several, from different angles) of a physical sample, then immediately log structured measurements against it.

## Product Purpose

Jotter lets a researcher capture photos of physical samples and log structured data against them using a fully custom, user-defined schema (fields and categories they design themselves, not a fixed form), then export everything to CSV. Success means a consistent, structured, exportable dataset, built without stitching together a separate camera app and spreadsheet by hand.

## Positioning

What a plain camera app plus a spreadsheet can't offer: a standardized capture protocol enforced per project — locked camera exposure (ISO/shutter/white balance) so lighting and color stay consistent across every capture, an angle-assist tilt guide, and "samples" that can be one photo or several named shots of the same physical object (Single Shot / Multi Shot) — all tied directly to that project's own custom field/category schema, and all working fully offline.

## Operating Context

Field conditions, frequently with poor or no connectivity. The researcher captures a sample, then logs its data immediately afterward, one sample at a time. No back-office or desk setting assumed — this happens wherever the physical samples are.

## Capabilities and Constraints

- Android only, phone, portrait orientation. No iOS or web target.
- Every project defines its own field schema: text, number, date, yes/no, category, photo, and auto-timestamp field types. Categories can be reusable across a person's own projects or scoped to a single field. A category field can optionally derive its value from a number field via threshold rules.
- A project is configured as **Single Shot** (one photo per sample, the default) or **Multi Shot** (the researcher defines named capture slots — e.g. multiple angles of one object — each optionally with a target tilt angle for the angle-assist guide).
- Offline-first: every write works with zero connectivity; sync to a remote backend resumes when connectivity returns.
- Camera capture requires locked manual exposure (ISO, shutter speed, white balance) held constant across every capture in a project — this is a hard product requirement, not a nice-to-have, and is planned via native platform work gated on device hardware support (not yet built).
- Accounts: guest (anonymous, fully functional) and registered (email/password or OAuth). Project sharing/collaboration between accounts is planned via invite.
- The product must never frame itself around academic/thesis language anywhere user-facing — it presents as a general-purpose data-collection tool.

## Brand Commitments

Product name is **Jotter**. (An earlier working prototype used the name "DataSnap" — that name is retired and should not appear in new user-facing work.)

Visual identity is a **dark-only, editorial-industrial theme** (near-black canvas, confident uppercase display type contrasted against light-weight body copy, hairline dividers instead of shadows, flat/sharp-cornered controls) — directionally inspired by BMW M's marketing aesthetic, but rebuilt with an original typeface pairing (Inter, not BMW's licensed face) and an original signature accent: the **Calibration Stripe**, a warm-to-cool amber → emerald → cyan sequence that represents the white-balance range the app's locked-exposure camera calibrates against per project. Emerald remains the single primary interactive accent (buttons, selected states), carried over from the app's original palette. Full system defined in DESIGN.md.

## Evidence on Hand

None. There is no existing dataset, reference photo set, or prior spreadsheet this product is modeled on — it's an original idea, not a digitization of an existing tool or process. Future work must not fabricate example data, testimonials, or case studies.

## Product Principles

1. Simplicity over flexibility for a non-technical field user — favor linear flows and fewer on-screen decisions over configurability for its own sake.
2. Consistency of capture is a first-class product concern — locked exposure and angle guidance exist because uncontrolled variation in captured photos undermines the reason the data is being collected at all.
3. The schema is fully custom, never fixed — a single predefined form can't fit every kind of physical-sample study this product might be used for.
4. Offline-first, always — the operating context can't guarantee connectivity, so the product must not depend on it for core use.
5. Usability for non-technical users is a self-imposed design bar, not an externally mandated one — see Accessibility & Inclusion.

## Accessibility & Inclusion

No formal standard (e.g. WCAG) is required of this product. The bar is self-imposed: the target user is not comfortable with technology, so interfaces should default to large touch targets, plain-language labels, and minimal branching regardless of any formal requirement.
