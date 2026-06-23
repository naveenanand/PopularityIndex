import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['postgres', 'drizzle-orm', '@pai/db'],
};

export default nextConfig;
