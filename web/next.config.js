/** @type {import('next').NextConfig} */
const APP_ID       = process.env.APP_ID       || 'local';
// Derive the public prefix exactly once.
const APP_BASE_PATH = process.env.APP_BASE_PATH || `/dapp/${APP_ID}`;

const nextConfig = {
  /* --- mandatory for Docker test -f step --- */
  output: 'standalone',

  /* --- wallet adapter must be transpiled --- */
  transpilePackages: [
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-wallets',
    '@solana/wallet-adapter-phantom',
    '@solana/wallet-adapter-solflare',
  ],

  /* ✨ tell Next.js every route lives under /dapp/<id>/ */
  /** Read at *build-time*  ➜  gets baked into server.js */
  basePath:   APP_BASE_PATH,
  assetPrefix: APP_BASE_PATH,

  // relax frame restrictions so the SolanaFlow UI can embed it
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors *; default-src * 'unsafe-inline' blob: data:;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
