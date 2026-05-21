/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained build in .next/standalone for Docker deployment.
  output: 'standalone',
};

export default nextConfig;
