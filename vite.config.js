import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  root: path.join(__dirname, 'src', 'renderer'),
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
              return 'vue-vendor'
            }
            if (id.includes('element-plus') || id.includes('@element-plus')) {
              return 'element-plus'
            }
            if (id.includes('echarts')) {
              return 'echarts'
            }
            if (id.includes('dayjs')) {
              return 'dayjs'
            }
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src', 'renderer'),
      '@components': path.join(__dirname, 'src', 'renderer', 'components'),
      '@views': path.join(__dirname, 'src', 'renderer', 'views'),
      '@stores': path.join(__dirname, 'src', 'renderer', 'stores'),
      '@utils': path.join(__dirname, 'src', 'renderer', 'utils'),
      '@api': path.join(__dirname, 'src', 'renderer', 'api'),
      '@shared': path.join(__dirname, 'src', 'shared')
    }
  }
})
