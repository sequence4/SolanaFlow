/** @type {import("next").NextConfig} */
const nextConfig = {
  // tell Vercel/Next "stand-alone" mode – already set by env
  output: "standalone",

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
