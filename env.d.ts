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
  }
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string;
  export default url;
}
