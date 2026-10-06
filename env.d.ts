declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
  }
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string;
  export default url;
}
