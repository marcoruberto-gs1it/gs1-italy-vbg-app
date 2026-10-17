import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

// La fotocamera richiede HTTPS: con `npm run dev` il server è raggiungibile
// anche dal telefono in rete locale tramite un certificato self-signed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const token = env.VBG_API_TOKEN

  if (!token) console.warn('\n⚠️  VBG_API_TOKEN mancante in .env.local: la verifica Verified by GS1 non funzionerà.\n')

  // L'API VbG non abilita il CORS: il browser chiama /api/vbg e il proxy inoltra la richiesta
  // aggiungendo il token lato server. In produzione serve un backend che faccia lo stesso.
  const vbgProxy: Record<string, ProxyOptions> = {
    '/api/vbg': {
      target: 'https://api.vbg.gs1it.org',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/vbg/, '/v2'),
      configure: (proxy) => {
        proxy.on('proxyReq', (req) => {
          req.setHeader('Authorization', `Token ${token ?? ''}`)
          req.removeHeader('cookie')
          req.removeHeader('origin')
          req.removeHeader('referer')
        })
      },
    },
  }

  return {
    // Su GitHub Pages l'app vive in /<nome-repo>/: il workflow imposta BASE_PATH.
    base: process.env.BASE_PATH ?? '/',
    plugins: [react(), basicSsl()],
    // allowedHosts: consente il tunnel HTTPS di `npm run tunnel` (certificato valido → il permesso fotocamera resta salvato).
    server: { host: true, proxy: vbgProxy, allowedHosts: ['.trycloudflare.com'] },
    preview: { host: true, proxy: vbgProxy },
    worker: { format: 'es' },
  }
})
