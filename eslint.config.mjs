import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // The Reactors run in Basis Theory's Node.js runtime and the store on its own
  // host; neither is part of this app's build.
  globalIgnores(['.next/**', 'next-env.d.ts', 'reactors/**', 'store/**']),
]);
