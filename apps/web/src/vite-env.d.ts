/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare module "*.md?raw" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
