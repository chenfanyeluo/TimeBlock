import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  root: path.join(__dirname, 'renderer'),
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'renderer'),
      '@components': path.join(__dirname, 'renderer/components'),
      '@views': path.join(__dirname, 'renderer/views'),
      '@stores': path.join(__dirname, 'renderer/stores'),
      '@utils': path.join(__dirname, 'renderer/utils')
    }
  }
})
