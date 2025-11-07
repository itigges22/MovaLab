import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@supabase/ssr'],
  // Configure on-demand revalidation for chunk loading
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Optimize compilation performance
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Reduce compilation overhead
  typescript: {
    // Skip type checking during build for faster dev compilation
    ignoreBuildErrors: false,
  },
  // Optimize webpack for faster compilation
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Faster source maps in development
      config.devtool = 'eval-cheap-module-source-map';
    }
    return config;
  },
};

export default nextConfig;
