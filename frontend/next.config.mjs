/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained build in .next/standalone for Docker deployment.
  output: 'standalone',

  // Allow external server IP for Next.js dev mode
  allowedDevOrigins: ['13.48.130.180'],
};

export default nextConfig;