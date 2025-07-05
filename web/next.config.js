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

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors *; default-src * 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"} blob: data:;`,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
