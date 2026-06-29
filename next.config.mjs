/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "**" },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
