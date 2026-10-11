# Consulta AVGUST — Gemini gratis en el portal de finca

Respuesta corta para Kevin: **sí se puede** un chat acotado a agricultura y a AVGUST CARE 360 con la API gratuita de Google AI Studio, **pero hoy no hay clave en el proyecto** y el portal de Firebase Hosting es un sitio estático. El botón **Consulta** ya está en el portal (abajo a la izquierda, solo con la sesión de la finca) y queda **apagado** hasta que la clave viva en un servidor. No se enciende facturación desde este repo.

## Qué hay y qué no

| Pieza | Estado |
| --- | --- |
| Clave `GEMINI_API_KEY` en git, `NEXT_PUBLIC_*` o el bundle | No. No debe commitearse |
| Clave en el proceso local | Solo si Kevin la exporta en la terminal (`npm run consulta:listen`) |
| Secreto de Cloud Functions | No se pudo crear: Secret Manager exige Blaze |
| `firebase-applet-config.json` | Es la config web de Firebase (Auth, Firestore). Su `apiKey` **no** es una clave de Gemini y no se usa para el chat |
| `metadata.json` → `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` | Marca del applet de AI Studio. No crea un backend en Hosting |
| Ruta de servidor `POST /api/consulta-avgust` | Lista, para vinext / un servidor Node. Hosting estático **no** la ejecuta |
| Función `consultaAvgust` | Registrada en `firebase.json` (`functions/index.js`). El deploy se detiene: el proyecto no tiene facturación |
| Plan de pago / Blaze / tarjeta | Sigue apagado. No lo vinculamos |

El prompt del sistema rechaza temas que no sean agrícolas y **no da dosis**. Es una guía, no un candado: un usuario insistente puede intentar salirse. La dosis, la mezcla y el diagnóstico de campo siguen siendo del ingeniero AVGUST, de la etiqueta y del registro ICA.

## Límites del tier gratuito (11 oct 2026)

Fuente: [precios de Gemini](https://ai.google.dev/gemini-api/docs/pricing) y [límites](https://ai.google.dev/gemini-api/docs/rate-limits) (página de límites actualizada el 9 oct 2026).

- El modelo por defecto del servidor es `gemini-3.5-flash-lite`. El 11 oct 2026 la API, con una clave de usuario nuevo, respondió 404 a `gemini-2.5-flash-lite` y a `gemini-2.5-flash` y pidió usar `gemini-3.5-flash-lite`. Ese id contestó una pregunta de aseguramiento. `gemini-2.0-flash` no se usa.
- Google **no publica** una tabla fija de solicitudes por minuto. El cupo se mide por proyecto (no por clave) en tres ejes: solicitudes por minuto (RPM), tokens de entrada por minuto (TPM) y solicitudes por día (RPD). El día se reinicia a medianoche, hora del Pacífico. Los números exactos se ven en [AI Studio](https://aistudio.google.com/) → el proyecto → límites. La propia documentación dice que esos límites no están garantizados y cambian.
- Si el cupo se acaba, la API responde 429. El portal muestra un aviso para **esperar**. Eso no se arregla pegando una tarjeta.
- En el tier gratis, la columna «Used to improve our products» está en **Yes**: Google puede usar el texto para mejorar sus modelos. En el tier de pago, esa columna pasa a No. Por eso el chat **no** debe recibir cédulas, teléfonos, contratos ni el informe completo. Solo el nombre de la finca y de la persona invitada, y la pregunta.
- Caché de contexto y Batch, en estos modelos, figuran como no disponibles en el tier gratis. No usamos búsqueda de Google (Grounding): en varios modelos el grounding del tier gratis no está, y encenderlo no hace falta para esta consulta.
- Pasar el proyecto a un tier de pago exige **vincular una cuenta de facturación** en AI Studio (Tier 1). Este trabajo no lo hace. Una clave creada en AI Studio y dejada en el tier Free no cobra por token.

AI Studio en el navegador, en las regiones donde está disponible, también es sin costo según la nota de precios. La clave de API es otra cosa: solo sigue gratis mientras el proyecto no tenga facturación.

## Cómo pegar la clave (sin subirla a git)

1. Entra a [Google AI Studio → API keys](https://aistudio.google.com/apikey) con la cuenta que administra el proyecto (`vixnine777@gmail.com` u otra que Kevin controle).
2. Crea una clave en un proyecto que **siga en Free**. No vincules billing.
3. En la máquina donde corre el servidor (no en el build de Hosting):

```powershell
$env:GEMINI_API_KEY = "pega-la-clave-aqui"
npm run dev:portal
```

En bash:

```bash
export GEMINI_API_KEY="pega-la-clave-aqui"
npm run dev:portal
```

4. Abre el portal de finca en localhost, entra con una invitación y usa **Consulta**. `GET /api/consulta-avgust` responde `available: true` solo si el proceso ve la clave.
5. `GOOGLE_API_KEY` sirve como alias. `GEMINI_MODEL` puede cambiar el id (por defecto `gemini-3.5-flash-lite`). Ninguna de estas variables lleva prefijo `NEXT_PUBLIC_`: si lo llevara, quedaría dentro del JavaScript público.

Demo local (la clave solo en el entorno del proceso, puerto 8787):

```bash
export GEMINI_API_KEY="pega-la-clave-aqui"
npm run consulta:listen
curl -s http://127.0.0.1:8787/api/consulta-avgust
```

`available: true` solo si ese proceso ve la clave. El portal en localhost puede apuntar a ese proceso con `NEXT_PUBLIC_CONSULTA_AVGUST_URL=http://127.0.0.1:8787/api/consulta-avgust` en el build o el dev server. Esa URL no sirve para los visitantes de `web.app` (su navegador no llega a tu máquina).

No crees un archivo `.env` dentro del repo con la clave, y no la subas a GitHub.

## Por qué Hosting no llama a Gemini solo

`npm run deploy:portal` publica HTML y JS estáticos. Las rutas `/api/*` no corren ahí. Meter la clave en el cliente la dejaría visible para cualquiera y gastaría el cupo gratis.

Para que el botón del sitio `web.app` hable con Gemini hace falta una URL HTTPS que **ya** tenga la clave en el servidor, y volver a construir el portal con:

```bash
export NEXT_PUBLIC_CONSULTA_AVGUST_URL="https://tu-servidor/api/consulta-avgust"
npm run deploy:portal
```

Esa URL es pública (cualquiera que la conozca puede gastar el cupo). No es la clave, pero conviene no anunciarla. Orígenes permitidos por CORS: `gen-lang-client-0175464290.web.app`, `gen-lang-client-0175464290.firebaseapp.com` y localhost. Un dominio propio se agrega con `CONSULTA_AVGUST_ORIGINS` (lista separada por comas) en el **servidor**.

### Cloud Function — bloqueada: el proyecto no está en Blaze

Comprobado el 11 oct 2026 con la cuenta `vixnine777@gmail.com` en **gen-lang-client-0175464290**:

- Facturación: `billingEnabled: false`, sin cuenta de facturación.
- `firebase functions:secrets:set GEMINI_API_KEY` se niega: Secret Manager no se habilita hasta pasar a Blaze.
- `npm run deploy:consulta` prepara el paquete y luego se niega: Artifact Registry no se habilita hasta pasar a Blaze.
- La API de Cloud Functions sí quedó habilitada. Eso no despliega la función ni enciende cobro.

**No vinculamos una tarjeta ni un plan Blaze desde este repo.** Gemini en tier gratis y Blaze son cosas distintas: la función necesita Blaze para existir, aunque el modelo no cobre por token.

La función ya está escrita. Nombre: `consultaAvgust`. Región: `us-central1`. Secreto: `GEMINI_API_KEY` (nunca el valor en el código). CORS solo para el origen de Hosting, `firebaseapp.com` y localhost. El predeploy copia `lib/consulta-avgust-core.mjs` dentro de `functions/`. `npm run deploy:portal` sigue publicando solo Hosting y reglas; no intenta la función.

Cuando Kevin acepte Blaze en la consola, los pasos son:

```bash
firebase functions:secrets:set GEMINI_API_KEY
npm run deploy:consulta
export NEXT_PUBLIC_CONSULTA_AVGUST_URL="https://us-central1-gen-lang-client-0175464290.cloudfunctions.net/consultaAvgust"
npm run deploy:portal
```

Esa URL es el patrón público. No pegar la clave en esa variable. `scripts/build-firebase.mjs` la copia al bundle solo si es `https://…` y rechaza valores que parecen una clave. Si la variable no está, el botón de `web.app` sigue apagado. No apuntes el Hosting a la función hasta que `GET` de esa URL responda `available: true`.

Rota la clave en [AI Studio](https://aistudio.google.com/apikey) si alguna vez se pegó en un chat. La clave nueva va solo al entorno del servidor o a Secret Manager.

## Qué responde el chat

Solo orientación de manejo, capítulos del aseguramiento y qué preparar para la visita. Si piden dosis o un tema ajeno al campo, el prompt pide un rechazo corto. El pie del panel lo repite: no sustituye al técnico.
