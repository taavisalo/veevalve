import type { NextConfig } from 'next';
import path from 'node:path';

import { getWebSecurityHeaders } from './lib/security-headers';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  poweredByHeader: false,
  transpilePackages: ['@veevalve/core', '@veevalve/ui'],
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: getWebSecurityHeaders(process.env.NODE_ENV === 'production'),
      },
    ];
  },
};

export default nextConfig;
