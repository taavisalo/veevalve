import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@veevalve/core', '@veevalve/ui'],
};

export default nextConfig;
