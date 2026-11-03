import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: https://wutpvsnqkmcxmuixpmfv.supabase.co; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://wutpvsnqkmcxmuixpmfv.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
      ],
    }];
  },
  experimental: {
    // The Tailwind stylesheet is ~7KB gzipped. Inlining it removes the only
    // render-blocking request, which helps LCP for first visits on mobile data.
    inlineCss: true,
    // Newsroom photo uploads. Browsers resize to 2000px WebP first (usually
    // under 1 MB); the server still enforces its own 10 MB limit and message.
    serverActions: { bodySizeLimit: "11mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wutpvsnqkmcxmuixpmfv.supabase.co",
        pathname: "/storage/v1/object/public/article-media/**",
      },
    ],
    // 90 is used for the logo, so its flat lime stays clean.
    qualities: [75, 90],
  },
};

export default nextConfig;
