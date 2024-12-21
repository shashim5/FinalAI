import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2015',
    rollupOptions: {
      input: './src/test.html'
    }
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true
  }
})
