import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  root: path.join(__dirname, 'src', 'renderer'),
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src', 'renderer'),
      '@components': path.join(__dirname, 'src', 'renderer', 'components'),
      '@views': path.join(__dirname, 'src', 'renderer', 'views'),
      '@stores': path.join(__dirname, 'src', 'renderer', 'stores'),
      '@utils': path.join(__dirname, 'src', 'renderer', 'utils')
    }
  }
})
