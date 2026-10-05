# AVGUST CARE 360 — Development Rules

## Source of truth
The application source must be the source of truth. APK files are release artifacts only.

## Forbidden for normal feature development
- Editing a compiled APK as the implementation source.
- Adding a feature only through a Python patch against a bundled/minified application.
- Treating `tools/base/capacitor-seed.apk` as the current application source.

## Transitional layer
`enhance/src/` is retained during migration because it contains validated field UX, metrics and operational behavior.

## Release safety
- Never rotate the production signing key without an explicit migration plan.
- Never reduce Android `versionCode`.
- Preserve offline/local data compatibility.
- Preserve official MIPE mathematics unless a separately reviewed math change is approved.
- Every release must pass the quality gate.

## Migration completion
The migration is complete only when a clean checkout can build the APK without extracting an APK seed and without patching a compiled application bundle.
