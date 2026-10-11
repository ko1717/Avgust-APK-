declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
  }
}

declare namespace NodeJS {
  interface ProcessEnv {
    /** Fixed public origin for farm-portal invitation links (Firebase Hosting). */
    PUBLIC_PORTAL_ORIGIN?: string;
    NEXT_PUBLIC_PORTAL_ORIGIN?: string;
    /** When "1", the client bundle mounts only the farm portal (Firebase Hosting). */
    NEXT_PUBLIC_HOSTING_PORTAL_ONLY?: string;
    /**
     * HTTPS URL of the consult proxy (Cloud Function or Vinext `/api/consulta-avgust`).
     * Public at build time. Never put the Gemini key here.
     */
    NEXT_PUBLIC_CONSULTA_AVGUST_URL?: string;
    /** Server-only. Google AI Studio free-tier key. */
    GEMINI_API_KEY?: string;
    /** Server-only alias of GEMINI_API_KEY. */
    GOOGLE_API_KEY?: string;
    /** Server-only model id. Defaults to gemini-3.5-flash-lite. */
    GEMINI_MODEL?: string;
    /** Extra browser origins allowed to call the consult route, comma-separated. */
    CONSULTA_AVGUST_ORIGINS?: string;
  }
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string;
  export default url;
}
