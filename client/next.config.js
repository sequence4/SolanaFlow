// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable additional React warnings
  reactStrictMode: true,

  // Image optimisation settings
  // (If you later need remote images, add their hosts to this array
  // or migrate to `images.remotePatterns` – see docs.)
  images: {
    domains: [],
  },

  // Extra webpack settings
  webpack: (config) => {
    // Ensure config.resolve exists before extending it
    config.resolve = config.resolve || {};

    // Polyfill Node’s `buffer` in the browser bundle
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      buffer: require.resolve('buffer/'),
    };

    return config;
  },

  // Proxy back-end requests during development
  async rewrites() {
    return [
      {
        // keep /api so Express still matches /api/*
        source: '/api/:path*',
        destination: 'http://localhost:9999/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
