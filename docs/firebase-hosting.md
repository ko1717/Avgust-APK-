# Firebase Hosting — portal / servidor en línea

Publica el portal de finca (`/?portal=finca`) en Firebase Hosting (estático) junto con las reglas de Firestore del proyecto **avgustscare360**.

## Comandos

```bash
npm install
npx firebase login              # una vez, en máquina local
# Completar appId + messagingSenderId en firebase-applet-config.json
# (Consola → Configuración del proyecto → Tus apps → app web)
npm run build:firebase          # vinext build + stage dist/firebase-hosting
npm run deploy:firebase         # hosting + firestore rules/indexes
# o solo hosting:
npx firebase deploy --only hosting
```

Tras el deploy: `https://avgustscare360.web.app/?portal=finca` (o el dominio custom).

## Variables opcionales

- `PUBLIC_PORTAL_ORIGIN` / `NEXT_PUBLIC_PORTAL_ORIGIN` — origen fijo para enlaces de invitación WhatsApp.
  - Por defecto / en `build:firebase`: `https://avgustscare360.web.app`.
  - En localhost / ChatGPT Sites / workers.dev el cliente también cae a ese Hosting URL (así WhatsApp no apunta al shell de Sites).

## Deploy desde GitHub Actions (recomendado)

El workflow [`.github/workflows/firebase-hosting.yml`](../.github/workflows/firebase-hosting.yml) publica a **avgustscare360** en cada push a `codex/nuevas-metricas-mipe`, o al lanzarlo a mano (`workflow_dispatch`).

**Una sola vez — secret en el repo (no hace falta “añadir gente” a Firebase por separado):**

1. En cualquier máquina con Firebase CLI: `npx firebase login:ci` → copia el token.
2. GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
3. Name: `FIREBASE_TOKEN` · Value: el token (nunca lo subas al código).
4. **Actions** → workflow **Firebase Hosting deploy** → **Run workflow**, o haz push a la rama.

Ser colaborador de Firebase o de GitHub **no** despliega el sitio: el secret `FIREBASE_TOKEN` es la credencial que usa Actions.

## Consola Firebase (humano) — proyecto avgustscare360

1. **Firestore → Crear base de datos** si aún no existe (modo producción o de prueba; ID `(default)`).
2. **Authentication → Sign-in method → Anonymous**: habilitar (portal llama `ensurePortalAuth`).
3. **Authentication → Settings → Authorized domains**: confirmar `avgustscare360.web.app` y `avgustscare360.firebaseapp.com`.
4. **Configuración del proyecto → Tus apps**: copiar `appId` y `messagingSenderId` a `firebase-applet-config.json`.
5. Deploy local (opcional; el camino habitual es Actions + `FIREBASE_TOKEN`):
   ```bash
   npx firebase login
   npm run deploy:firebase
   # o por capas:
   npm run firebase:deploy:rules
   npm run firebase:deploy:hosting
   ```
6. Verificar: `https://avgustscare360.web.app/?portal=finca`.
7. **Regenerar invitaciones** tras el deploy: Firestore está vacío en el proyecto nuevo; los enlaces viejos a `gen-lang-client-*.web.app` no sirven.

## Limitaciones

- Hosting sirve el **shell estático** del build vinext. El portal y los informes en línea usan **Firestore + Auth en el cliente**.
- Las rutas `/api/*` (D1/R2 / Sites) **no** corren en Hosting estático. El app completo autenticado sigue en Vinext/Cloudflare Sites (`npm run start` / Sites deploy).
- No se aprovisionan usuarios Auth reales en este flujo (anónimo + códigos de invitación).
- Proyecto anterior (`gen-lang-client-0175464290` / DB nombrada AI Studio): ya no es el target de deploy ni de invitaciones.
