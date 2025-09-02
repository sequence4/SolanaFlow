/** @type {import('next').NextConfig} */
const APP_ID       = process.env.APP_ID       || 'local';
// Derive the public prefix exactly once from the current APP_ID
const APP_BASE_PATH = `/dapp/${APP_ID}`;

const nextConfig = {
  output: 'standalone',

  transpilePackages: [
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-wallets',
    '@solana/wallet-adapter-phantom',
    '@solana/wallet-adapter-solflare',
  ],

  basePath:   APP_BASE_PATH,
  assetPrefix: APP_BASE_PATH,
  
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,
  
  // Webpack configuration for hot reload
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Enable hot module replacement
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.next'],
      };
      
      // Add custom loader for generated components
      config.module.rules.push({
        test: /generated\/.*\.(jsx?|tsx?)$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['next/babel'],
              plugins: [
                ['react-refresh/babel', { skipEnvCheck: true }]
              ],
            },
          },
        ],
      });
      
      // Add alias for generated components
      config.resolve.alias = {
        ...config.resolve.alias,
        '@generated': '/usr/src/*/web/src/components/generated',
      };
      
      // Enable WebSocket for hot reload
      config.infrastructureLogging = {
        level: 'info',
      };
    }
    
    return config;
  },
  
  // Environment variables accessible in the browser
  env: {
    NEXT_PUBLIC_HOT_RELOAD: process.env.NODE_ENV === 'development' ? 'true' : 'false',
    NEXT_PUBLIC_WS_URL: process.env.WS_URL || 'ws://localhost:3001/ws',
    NEXT_PUBLIC_APP_ID: APP_ID,
    NEXT_PUBLIC_BASE_PATH: APP_BASE_PATH,
  },

  /** Proxy configuration for local RPC */
  async rewrites() {
    return [
      {
        source: '/rpc',
        destination: 'http://localhost:28899',
      },
      {
        source: '/rpc/:path*',
        destination: 'http://localhost:28899/:path*',
      },
    ];
  },

  /** Allow the app to be embedded in SolanaFlow's iframe (different port). */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { 
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' http://localhost:* ws://localhost:*" 
          },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
  
  // Development server configuration
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },
  
  // Component optimization
  modularizeImports: {
    '@mui/icons-material': {
      transform: '@mui/icons-material/{{member}}',
    },
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
};

module.exports = nextConfig;
