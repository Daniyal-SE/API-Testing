import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyUnbundledSrcAssets(): Plugin {
  return {
    name: 'copy-unbundled-src-assets',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const srcAssets = path.resolve(__dirname, 'src/assets');
      const distAssets = path.resolve(distDir, 'src/assets');
      if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
        fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyUnbundledSrcAssets()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
