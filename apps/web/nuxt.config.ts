// A static single-page app: every read goes from the browser to the chain and every write is signed
// by the user's wallet, so there is no server.
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  ssr: false,
  // Always plain static output in .output/public. On Cloudflare Pages, Nitro would otherwise switch to its
  // cloudflare-pages-static preset and write to dist/, keeping the 404.html that breaks the SPA fallback.
  nitro: { preset: 'static' },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Yield Forward',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'description', content: 'Deposit crypto and let the yield it earns fund a community you care about. Withdraw anytime.' }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        // iOS home screen; a full-bleed PNG of icon.svg, since iOS rounds the corners itself.
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      // Which deployments/<name>.json the site reads, comma-separated, one per chain. The first is the default chain.
      deployments: 'hoodi-dev',
      // From the MetaMask Embedded Wallets (Web3Auth) dashboard. Any string works on localhost.
      web3AuthClientId: 'localhost-development',
      web3AuthNetwork: 'sapphire_devnet',
      // Overrides the deployments' public RPCs: `560048=https://a,https://b;1=https://c`.
      rpcUrls: '',
    },
  },
  // Self-hosted at build time, so visitors' browsers never call Google.
  fonts: {
    families: [{ name: 'Onest', provider: 'google', weights: [400, 500, 600, 700] }],
  },
  icon: {
    clientBundle: { scan: true },
  },
  vite: {
    optimizeDeps: {
      include: [
        '@tanstack/vue-query',
        // vue-query imports this CommonJS package; unbundled, dev mode can't load it and the app never mounts.
        '@tanstack/vue-query > @vue/devtools-api',
        '@wagmi/core',
        '@wagmi/vue',
        '@web3auth/modal/vue',
        '@web3auth/modal/vue/wagmi',
        'viem',
        'viem/chains',
      ],
    },
  },
  typescript: { strict: true },
})
