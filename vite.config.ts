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
            // Use esbuild (Vite's default) - faster and built-in, no extra dependency needed
            // Note: terser requires explicit installation since Vite v3
            minify: 'esbuild',
            cssMinify: true,
            rollupOptions: {
              output: {
                // Dynamic manualChunks to avoid empty chunk warnings
                manualChunks(id) {
                  // React core libraries
                  if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
                    return 'react';
                  }
                  // Only create vendor chunk if @google/genai is actually imported in frontend
                  if (id.includes('node_modules/@google/genai')) {
                    return 'vendor';
                  }
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
