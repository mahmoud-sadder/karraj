import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Set just above the engine chunk. three + R3F + drei + postprocessing is 1.22 MB
    // minified and there is no version of this project that does not carry it, so
    // warning about it every build only teaches everyone to ignore build warnings.
    // Tight enough that anything ELSE crossing the line still gets flagged.
    chunkSizeWarningLimit: 1250,
    rollupOptions: {
      output: {
        /**
         * Split the engine away from the app.
         *
         * First load is byte-identical either way, so this buys nothing for a new
         * visitor. It buys a lot for a returning one: three, R3F, drei and the
         * post-processing chain are ~90% of the JS and change only when a dependency
         * is bumped, while the app code changes on every push. Kept in one chunk they
         * are re-downloaded together every deploy; split, a redeploy costs the app
         * chunk alone and the engine stays in a year-long immutable cache.
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](three|@react-three|postprocessing|meshoptimizer|three-stdlib)[\\/]/.test(id)) {
            return 'three'
          }
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]/.test(id)) {
            return 'react'
          }
        },
      },
    },
  },
})
