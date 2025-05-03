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
  }
}

export default nextConfig
