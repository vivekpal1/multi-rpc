/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: {
      displayName: false,
      ssr: true,
      fileName: false,
      cssProp: true,
    },
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