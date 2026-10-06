import { defineConfig } from 'tsup';

// Bundle the workspace packages (TS source); keep real npm deps external.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node22',
  clean: true,
  splitting: false,
  noExternal: [/^@erp\//],
  // ...and their transitive npm deps (prisma, nodemailer) stay as runtime imports
  external: [/^(?![./]|@erp\/)/],
});
