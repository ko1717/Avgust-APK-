# Firebase Hosting — portal / servidor en línea

Publica el portal de finca (`/?portal=finca`) en Firebase Hosting (estático) junto con las reglas de Firestore del proyecto existente.

## Comandos

```bash
npm install
npm run build:firebase          # vinext build + stage dist/firebase-hosting
npx firebase login              # una vez, en máquina local
npm run deploy:firebase         # hosting + firestore rules/indexes
# o solo hosting:
npx firebase deploy --only hosting
```

Tras el deploy: `https://gen-lang-client-0175464290.web.app/?portal=finca` (o el dominio custom).

## Variables opcionales

- `PUBLIC_PORTAL_ORIGIN` / `NEXT_PUBLIC_PORTAL_ORIGIN` — origen fijo para enlaces de invitación WhatsApp (ej. `https://gen-lang-client-0175464290.web.app`). Sin esto se usa `window.location.origin`.

## Consola Firebase (humano)

1. **Authentication → Sign-in method → Anonymous**: habilitar (portal llama `ensurePortalAuth`).
2. **Authentication → Settings → Authorized domains**: añadir el dominio de Hosting (`*.web.app`, `*.firebaseapp.com`, custom).
3. Login CI: `FIREBASE_TOKEN` (`firebase login:ci`) o Application Default Credentials.

## Limitaciones

- Hosting sirve el **shell estático** del build vinext. El portal y los informes en línea usan **Firestore + Auth en el cliente**.
- Las rutas `/api/*` (D1/R2 / Sites) **no** corren en Hosting estático. El app completo autenticado sigue en Vinext/Cloudflare Sites (`npm run start` / Sites deploy).
- No se aprovisionan usuarios Auth reales en este flujo (anónimo + códigos de invitación).
