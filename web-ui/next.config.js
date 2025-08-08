/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Optimize for faster development builds with Turbopack
  turbopack: {
    resolveAlias: {
      '@': './src',
    },
  },
  compiler: {
    styledComponents: {
      displayName: false,
      ssr: true,
      fileName: false,
      cssProp: true,
    },
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Performance optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'recharts'],
  },
  // Module optimization
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
  },
  // Disable type checking during development build for speed
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
  async rewrites() {
    // Only rewrite if we have a backend URL configured
    const backendUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL;
    
    if (!backendUrl || backendUrl.includes('localhost')) {
      // In development or when no backend is configured
      return [
        {
          source: '/api/rpc/:path*',
          destination: 'http://localhost:8080/:path*',
        },
      ];
    }
    
    // In production with configured backend
    return [
      {
        source: '/api/rpc/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  // Disable image optimization for Vercel free tier if needed
  images: {
    unoptimized: process.env.NODE_ENV === 'production',
  },
}

module.exports = nextConfig