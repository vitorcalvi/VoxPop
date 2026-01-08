import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';

    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            proxy: {
              '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true
              }
            }
          },
          plugins: [react()],
          define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
          },
          resolve: {
            alias: {
              '@': path.resolve(__dirname, '.'),
            }
          },
          build: {
            target: 'es2015',
            minify: 'terser',
            cssMinify: true,
            rollupOptions: {
              output: {
                manualChunks: {
                  'react': ['react', 'react-dom'],
                  'vendor': ['@google/genai']
                }
              }
            }
          },
          optimizeDeps: {
            include: ['react', 'react-dom', '@google/genai']
          },
          css: {
            devSourcemap: true,
            modules: {
              localsConvention: 'camelCase'
            }
          }
        };
    });
