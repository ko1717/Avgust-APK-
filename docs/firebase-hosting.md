# Firebase Hosting — portal de finca (solo clientes)

Publica **solo** el portal de finca para clientes/responsables en Firebase Hosting (estático), junto con las reglas de Firestore del proyecto **gen-lang-client-0175464290** (Proyecto nanda / cuenta `vixnine777@gmail.com`).

La consola técnica completa de AVGUST CARE 360 **no** se sirve en Hosting: permanece en Vinext / Cloudflare Sites / escritorio. El build de Hosting fija `NEXT_PUBLIC_HOSTING_PORTAL_ONLY=1`, monta `FarmPortalHost` (sin `workspace`) y fuerza `portal=finca` en la URL.

## Verificación local (antes de deploy)

Sin login de Firebase, el repo puede comprobar que la config del portal no se ha desviado:

```bash
npm run verify:firebase-portal
```

El script (`scripts/verify-firebase-portal.mjs`) exige `firebase-applet-config.json` completo (apiKey, appId, …), `.firebaserc` → **gen-lang-client-0175464290**, Firestore named DB `ai-studio-avgustapk-…`, reglas con `invitations` / `visits` / `reports` + `portalListOk`, y los scripts de prepare/hosting. Sale con código ≠ 0 si falta algo.

**Plugin / MCP Firebase en Cursor:** instala el plugin Firebase del Marketplace (o deja `.cursor/mcp.json` con el servidor `firebase` → `npx firebase-tools@latest mcp`). Tras `firebase login` en la máquina, el agente puede consultar el proyecto en vivo (apps, hosting, reglas). Hasta entonces, `npm run verify:firebase-portal` atrapa drift de config en local.

## Camino fácil (Windows)

1. Instala [Node.js 22+](https://nodejs.org) si aún no lo tienes.
2. En la carpeta del repo, **doble clic** en `deploy-portal.bat`  
   (o clic derecho en `deploy-portal.ps1` → *Ejecutar con PowerShell*).
3. Cuando se abra el navegador, inicia sesión con la cuenta de Google que tiene acceso a Firebase (`vixnine777@gmail.com`).
4. Espera a que termine el build y el deploy.
5. Abre: **https://gen-lang-client-0175464290.web.app/** (portal de finca; `/?portal=finca` es equivalente)

No hace falta configurar secrets de GitHub ni tokens de CI. El script hace: `npm install` (si falta), `firebase login`, selecciona `gen-lang-client-0175464290` y `npm run deploy:firebase`.

Equivalente desde una terminal ya logueada:

```bash
npm run deploy:portal
```

## Variables opcionales

- `PUBLIC_PORTAL_ORIGIN` / `NEXT_PUBLIC_PORTAL_ORIGIN` — origen fijo para enlaces de invitación WhatsApp.
  - Por defecto / en `build:firebase`: `https://gen-lang-client-0175464290.web.app`.
  - En localhost / ChatGPT Sites / workers.dev el cliente también cae a ese Hosting URL (así WhatsApp no apunta al shell de Sites).

## Consola Firebase (una vez por proyecto)

1. **Firestore**: el portal usa la base named `ai-studio-avgustapk-f7ec9dbe-9fd2-41ac-9388-c71e7384bb8a` (no `(default)`).
2. **Authentication → Sign-in method → Anonymous**: habilitar (portal llama `ensurePortalAuth`).
3. **Authentication → Settings → Authorized domains**: confirmar `gen-lang-client-0175464290.web.app` y `gen-lang-client-0175464290.firebaseapp.com`.
4. **Configuración del proyecto → Tus apps**: web app **AVGUST CARE 360** (`appId` / `messagingSenderId` en `firebase-applet-config.json`).

## Avanzado — comandos manuales

```bash
npm install
npx firebase login
npx firebase use gen-lang-client-0175464290
npm run build:firebase          # vinext build + stage dist/firebase-hosting
npm run deploy:firebase         # hosting + firestore rules/indexes
# o solo hosting:
npx firebase deploy --only hosting
```

## Avanzado — GitHub Actions + `login:ci`

El workflow [`.github/workflows/firebase-hosting.yml`](../.github/workflows/firebase-hosting.yml) puede publicar a **gen-lang-client-0175464290** en push a `main` o con `workflow_dispatch`. Es **opcional**; el camino fácil es el `.bat` de arriba.

**Una sola vez — secret en el repo:**

1. En una máquina con Firebase CLI: `npx firebase login:ci` → copia el token.
2. GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
3. Name: `FIREBASE_TOKEN` · Value: el token (nunca lo subas al código).
4. **Actions** → workflow **Firebase Hosting deploy** → **Run workflow**, o haz push a la rama.

Sin el secret `FIREBASE_TOKEN`, el workflow se salta el deploy (no falla el repo).

## Qué incluye el portal (Hosting)

- Acceso con código / enlace de invitación.
- Consulta de aseguramientos e informes en línea de la finca.
- Solicitud para **agendar un aseguramiento** (`assuranceRequests` en Firestore, estado `pending`); el técnico la revisa después — no es un calendario completo.

## Limitaciones

- Hosting sirve el **shell estático portal-only** del build vinext. El portal y los informes en línea usan **Firestore + Auth en el cliente**.
- Las rutas `/api/*` (D1/R2 / Sites) **no** corren en Hosting estático. El app completo autenticado sigue en Vinext/Cloudflare Sites (`npm run start` / Sites deploy).
- En Hosting no hay camino a la consola de técnicos (sin “Volver a la consola de trabajo”).
- No se aprovisionan usuarios Auth reales en este flujo (anónimo + códigos de invitación).
- Solo el proyecto **gen-lang-client-0175464290** es el target de Hosting, Firestore e invitaciones.
