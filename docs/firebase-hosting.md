# Firebase Hosting — portal de finca (solo clientes)

Publica **solo** el portal de finca para clientes/responsables en Firebase Hosting (estático), junto con las reglas de Firestore del proyecto **gen-lang-client-0175464290** (Proyecto nanda / cuenta `vixnine777@gmail.com`).

La consola técnica completa de AVGUST CARE 360 **no** se sirve en Hosting: permanece en Vinext / Cloudflare Sites / escritorio. El build de Hosting fija `NEXT_PUBLIC_HOSTING_PORTAL_ONLY=1`, monta `FarmPortalHost` (sin `workspace`) y sirve el portal en la raíz del dominio.

## URLs públicas (patrones)

| Uso | URL |
|-----|-----|
| Portal (entrada) | `https://gen-lang-client-0175464290.web.app/` |
| Alias opcional | `https://gen-lang-client-0175464290.web.app/finca` |
| Invitación (enlace WhatsApp) | `https://gen-lang-client-0175464290.web.app/?invitation=TOKEN` |
| Informe en línea | `https://gen-lang-client-0175464290.web.app/?view=online-report&id=VISIT_ID` |
| Legacy (sigue funcionando) | `/?portal=finca` y `/?portal=finca&invitation=…` — se normalizan quitando `portal=finca` |

Los enlaces que genera la app técnica **siempre** usan el origen `https://gen-lang-client-0175464290.web.app` (o tu dominio personalizado una vez configurado), nunca localhost ni Sites.

Vista previa del portal dentro de CARE 360 (localhost / Sites): `/?portal=finca` en la app completa.

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
5. Abre: **https://gen-lang-client-0175464290.web.app/**

No hace falta configurar secrets de GitHub ni tokens de CI. El script hace: `npm install` (si falta), `firebase login`, selecciona `gen-lang-client-0175464290` y `npm run deploy:firebase`.

Equivalente desde una terminal ya logueada:

```bash
npm run deploy:portal
```

## Variables opcionales

- Los enlaces de invitación y de informe **siempre** usan `https://gen-lang-client-0175464290.web.app`, aunque el técnico esté en localhost, Sites o `firebaseapp.com`. Un `NEXT_PUBLIC_PORTAL_ORIGIN` distinto no redirige esos enlaces hasta que actualices también `lib/portal-match.mjs` / dominio personalizado en Firebase.

## Dominio personalizado (Kevin debe ser titular del dominio)

Firebase no vende dominios: **Kevin** (o la organización) compra y controla el DNS en su registrador (GoDaddy, Cloudflare, Google Domains, etc.). Luego se enlaza al mismo sitio de Hosting.

### Checklist — Firebase Console

1. [Firebase Console](https://console.firebase.google.com/) → proyecto **gen-lang-client-0175464290** → **Hosting**.
2. **Agregar dominio personalizado** → escribe el dominio (p. ej. `portal.avgust.co` o `finca.tudominio.com`).
3. Elige si es dominio raíz (`example.com`) o subdominio (`portal.example.com`). Para raíz suele hacer falta un registro **A**; para subdominio, **CNAME**.
4. Copia los registros DNS que muestra Firebase (valores exactos de la consola; no uses ejemplos genéricos de internet).
5. En el registrador del dominio, crea esos registros y espera propagación (minutos a 48 h).
6. En Firebase, pulsa **Verificar** hasta que el dominio quede **Conectado**.
7. Activa **SSL** (Firebase provisiona certificado automáticamente cuando el DNS es correcto).

### Checklist — DNS (titular del dominio)

- [ ] Acceso de administrador al registrador (cuenta de Kevin).
- [ ] Registro **TXT** de verificación de Firebase (si lo pide el asistente).
- [ ] Registro **A** hacia las IPs de Hosting **o** **CNAME** hacia `gen-lang-client-0175464290.web.app` (según indique la consola).
- [ ] Sin registros conflictivos (otro A/CNAME en el mismo host).
- [ ] Tras conectar: en **Authentication → Settings → Authorized domains**, añadir el dominio personalizado.
- [ ] Actualizar enlaces públicos: `lib/portal-match.mjs` (`PORTAL_ORIGIN`) y `DEFAULT_FIREBASE_HOSTING_ORIGIN` en `lib/portal-origin.ts`, luego `npm run deploy:portal`.
- [ ] Probar invitación: `https://TU-DOMINIO/?invitation=TOKEN` y publicación de informe.

## Consola Firebase (una vez por proyecto)

1. **Firestore**: el portal usa la base named `ai-studio-avgustapk-f7ec9dbe-9fd2-41ac-9388-c71e7384bb8a` (no `(default)`).
2. **Authentication → Sign-in method → Anonymous**: habilitar (portal llama `ensurePortalAuth`).
3. **Authentication → Settings → Authorized domains**: confirmar `gen-lang-client-0175464290.web.app`, `gen-lang-client-0175464290.firebaseapp.com` y cualquier dominio personalizado.
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

## Flujo técnico → cliente (app → Firestore → portal)

Arquitectura fija: la consola CARE 360 **no** vive en Hosting. La app (web/escritorio) escribe en Firestore; el portal Hosting solo lee.

1. **Técnico** completa la visita en CARE 360 → pestaña **04 Informe** → **Publicar en línea**.
2. La app escribe/actualiza `reports/{visitId}` y `visits/{visitId}` en el proyecto **gen-lang-client-0175464290** (mismo id = actualizar informe, con `farmKey` para emparejar mayúsculas y espacios).
3. **Invitaciones** → crea código **ASEG-####** (los **MIPE-####** ya guardados siguen verificando) o copia el enlace WhatsApp (origen fijo `https://gen-lang-client-0175464290.web.app`).
4. **Cliente** abre el portal Hosting, entra con código/enlace y ve las visitas publicadas de su finca.

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
