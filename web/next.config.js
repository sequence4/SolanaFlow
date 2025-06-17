/** @type {import('next').NextConfig} */
const nextConfig = {
  /* --- mandatory for Docker test -f step --- */
  output: 'standalone',                     

  /* --- wallet adapter must be transpiled --- */
  transpilePackages: [
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-base',
    'next-themes',
  ],

  // relax frame restrictions so the SolanaFlow UI can embed it
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          {
            key: "Content-Security-Policy",
            // allow *your* app to be shown in any origin that loads it
            value: "frame-ancestors *; default-src * 'unsafe-inline' blob: data:;",
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;

