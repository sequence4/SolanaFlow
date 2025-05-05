import type { NextConfig } from 'next'

const e2e = process.env.E2E === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: []
  },
  compiler: {
    styledJsx: true,
    reactRemoveProperties: e2e 
      ? false 
      : { properties: ['^data-testid$'] }
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.google-analytics.com; connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com;"
          }
        ]
      }
    ]
  }
}

export default nextConfig
