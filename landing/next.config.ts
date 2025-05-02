import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: []
  },
  compiler: {
    styledJsx: true
  }
}

export default nextConfig
