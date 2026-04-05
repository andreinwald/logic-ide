import { defineConfig, Plugin } from 'vite';
import electron from 'vite-plugin-electron/simple';
import react from '@vitejs/plugin-react';
import path from 'node:path';

function mdTextPlugin(): Plugin {
  return {
    name: 'md-text',
    transform(code, id) {
      if (id.endsWith('.md')) {
        return { code: `export default ${JSON.stringify(code)};`, map: null };
      }
    },
  };
}

export default defineConfig({
  root: 'frontend',
  plugins: [
    react(),
    electron({
      main: {
        entry: path.resolve(__dirname, 'backend/main.ts'),
        onstart({ startup }) {
          startup();
        },
        vite: {
          plugins: [mdTextPlugin()],
          build: {
            outDir: path.resolve(__dirname, 'dist/electron'),
            rollupOptions: {
              external: ['@anthropic-ai/claude-agent-sdk'],
              output: { dynamicImportInCjs: false },
            },
          },
        },
      },
      preload: {
        input: path.resolve(__dirname, 'bridge/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist/electron'),
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@bridge': path.resolve(__dirname, 'bridge'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/electron'),
    emptyOutDir: false,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
