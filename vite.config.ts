import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Determines the correct base path for GitHub Pages, Vercel, local dev, or subpath deployment
const resolveBasePath = () => {
  if (process.env.VITE_BASE_PATH) {
    const p = process.env.VITE_BASE_PATH;
    return p.endsWith('/') ? p : `${p}/`;
  }
  if (process.env.BASE_PATH) {
    const p = process.env.BASE_PATH;
    return p.endsWith('/') ? p : `${p}/`;
  }
  if (process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1];
    return repo ? `/${repo}/` : './';
  }
  if (process.env.VERCEL) {
    return '/';
  }
  return './';
};

export default defineConfig(() => {
  return {
    base: resolveBasePath(),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
