import { defineConfig } from 'vite'

export default defineConfig({
  base: '/toad-game/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
