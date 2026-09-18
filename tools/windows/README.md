# Shell Windows (Electron)

Empaqueta la misma UI del APK como aplicación de escritorio.

- `src/main.js` — ventana + servidor local + persistencia SQLite
- `src/preload.js` — `AvgustFileBridge` (solo API `store*`, para que la UI diga Windows)
- `ui/` — se genera con `tools/build-windows.sh` (no se versiona)

```bash
# Desde la raíz del repo
tools/build-windows.sh
```

Salidas en `dist/`:

- `AVGUST-CARE-360-<ver>-Windows-portable.zip` — Edge/Chrome (liviano, en git)
- `AVGUST-CARE-360-<ver>-Windows-x64.zip` — Electron (grande; generar en local)
