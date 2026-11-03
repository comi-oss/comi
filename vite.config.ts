import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env': {},
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/.tools/**', '**/src-tauri/target/**', '**/src-tauri/gen/**', '**/artifacts/**', '**/downloads/**'] },
  },
  clearScreen: false,
}))
