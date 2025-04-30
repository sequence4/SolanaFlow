import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: []
  },
  output: 'export',
  compiler: {
    styledJsx: true
  }
}

export default nextConfig
