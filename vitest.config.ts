import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Reuses the app's Vite config (plugins, `@` alias) so tests resolve imports like the app does.
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      environment: 'node',
    },
  }),
);
