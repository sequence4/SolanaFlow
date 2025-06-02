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
        // forward any call starting with /api/… to Express
        source: '/api/:path*',
        destination: 'http://localhost:9999/:path*',
      },
    ];
  },
};

export default nextConfig;
