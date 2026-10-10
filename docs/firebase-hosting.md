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

- `PUBLIC_PORTAL_ORIGIN` / `NEXT_PUBLIC_PORTAL_ORIGIN` — origen fijo para enlaces de invitación WhatsApp.
  - Por defecto / en `build:firebase`: `https://gen-lang-client-0175464290.web.app`.
  - En localhost / ChatGPT Sites / workers.dev el cliente también cae a ese Hosting URL (así WhatsApp no apunta al shell de Sites).

## Consola Firebase (humano)

1. **Authentication → Sign-in method → Anonymous**: habilitar (portal llama `ensurePortalAuth`).
2. **Authentication → Settings → Authorized domains**: añadir el dominio de Hosting (`gen-lang-client-0175464290.web.app`, `gen-lang-client-0175464290.firebaseapp.com`, custom).
3. **Firestore → Database**: confirmar la DB nombrada `ai-studio-avgustapk-f7ec9dbe-9fd2-41ac-9388-c71e7384bb8a` (ya referenciada en `firebase.json` + `firebase-applet-config.json`).
4. Login CI: `FIREBASE_TOKEN` (`firebase login:ci`) o Application Default Credentials + `npx firebase login`.
5. Deploy:
   ```bash
   npm run deploy:firebase
   # o por capas:
   npm run firebase:deploy:rules
   npm run firebase:deploy:hosting
   ```
6. Verificar: `https://gen-lang-client-0175464290.web.app/?portal=finca` (sin login de ChatGPT Sites).

## Limitaciones

- Hosting sirve el **shell estático** del build vinext. El portal y los informes en línea usan **Firestore + Auth en el cliente**.
- Las rutas `/api/*` (D1/R2 / Sites) **no** corren en Hosting estático. El app completo autenticado sigue en Vinext/Cloudflare Sites (`npm run start` / Sites deploy).
- No se aprovisionan usuarios Auth reales en este flujo (anónimo + códigos de invitación).
