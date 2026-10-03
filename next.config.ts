import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) so the production
  // container ships without node_modules — small image, fast cold start.
  output: 'standalone',
};

export default nextConfig;
