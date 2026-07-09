import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tsconfigPaths from 'vite-tsconfig-paths'
import Terminal from 'vite-plugin-terminal'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Put ALL third-party deps in one vendor chunk. Rolldown's cross-chunk
        // init ordering was violating the module dependency graph for the
        // web3/crypto stack (viem, @noble/*, @scure/*, privy, reown): e.g.
        // @noble/curves' secp256k1 evaluated before its @noble/hashes `sha256`
        // dep, throwing "param hash is invalid. Expected hash, got undefined",
        // and a downstream "Class extends undefined" — both before React mounted
        // (white screen at boot). Co-locating node_modules in a single chunk lets
        // Rolldown topologically order the modules within it. App code still
        // route-splits via dynamic import(). Do NOT re-split the vendor graph.
        manualChunks(id: string) {
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
  server: {
    // Pinned to 5174 so the trading client never collides with the landing app
    // (apps/landing/vite.config.ts), which owns 5173. strictPort fails loudly
    // on a collision instead of silently drifting to another port.
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tsconfigPaths(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // Dev-only: streams the browser console to the terminal. The plugin's
    // virtual module (`__x00__virtual:terminal/console`) cannot be resolved
    // by Vite 8 / rolldown during production builds, so it's only loaded
    // for `vite serve`. No effect on runtime behaviour.
    ...(command === 'serve'
      ? [Terminal({ console: 'terminal', output: ['terminal', 'console'] })]
      : []),
  ],
}))
