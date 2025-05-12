import type { NextConfig } from 'next'

const e2e = process.env.E2E === '1'
const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  output: 'standalone',
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
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com'
    ].join(' ')

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://www.google-analytics.com",
      "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com"
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp
          }
        ]
      }
    ]
  }
}

export default nextConfig
