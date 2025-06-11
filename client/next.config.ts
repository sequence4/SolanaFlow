import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  webpack: (config) => {
    config.resolve.fallback = { 
      ...config.resolve.fallback,
      buffer: require.resolve("buffer/") 
    };
    return config;
  },
  
  async rewrites() {
    return [
      {
        // 👇 preserve /api so Express still matches /api/deploy, /api/projects, …
        source: '/api/:path*',
        destination: 'http://localhost:9999/api/:path*',   // <— was http://localhost:9999/:path*
      },
    ];
  },
};

export default nextConfig;
