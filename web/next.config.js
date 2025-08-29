/** @type {import('next').NextConfig} */
const APP_ID       = process.env.APP_ID       || 'local';
// Derive the public prefix exactly once from the current APP_ID
const APP_BASE_PATH = `/dapp/${APP_ID}`;

const nextConfig = {
  output: 'standalone',

  transpilePackages: [
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-wallets',
    '@solana/wallet-adapter-phantom',
    '@solana/wallet-adapter-solflare',
  ],

  basePath:   APP_BASE_PATH,
  assetPrefix: APP_BASE_PATH,

  /** Proxy configuration for local RPC */
  async rewrites() {
    return [
      {
        source: '/rpc',
        destination: 'http://localhost:28899',
      },
      {
        source: '/rpc/:path*',
        destination: 'http://localhost:28899/:path*',
      },
    ];
  },

  /** Allow the app to be embedded in SolanaFlow's iframe (different port). */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' http://localhost:*" },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
