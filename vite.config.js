import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/finale-api': {
          target: `https://app.finaleinventory.com/${env.VITE_FINALE_ACCOUNT}/api`,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/finale-api/, ''),
          secure: true,
        },
      },
    },
  }
})
