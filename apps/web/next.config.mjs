/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // site estático (Cloudflare Pages)
  images: { unoptimized: true },
};

export default nextConfig;
