/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crypto-signals/shared'],
  output: 'standalone',
};

module.exports = nextConfig;

