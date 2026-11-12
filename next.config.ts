import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) so the production
  // container ships without node_modules — small image, fast cold start.
  output: 'standalone',
  // The integration token store (DynamoDB) loads the AWS SDK via dynamic
  // import(). Keep these external so the standalone trace always copies them
  // into the image — otherwise they can be dropped, the SDK import fails, and
  // the store silently falls back to per-task in-memory, making a connection
  // look "connected" on one ECS task and "disconnected" on another.
  serverExternalPackages: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
};

export default nextConfig;
