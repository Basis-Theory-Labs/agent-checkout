import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  // Both talk to a remote browser over CDP and are meant to be required from
  // node_modules, not bundled.
  serverExternalPackages: ['playwright-core', '@browserbasehq/sdk'],
};

export default nextConfig;
