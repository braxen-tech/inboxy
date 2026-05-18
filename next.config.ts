import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Helps Turbopack pick up NEXT_PUBLIC_* from .env at config load time
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "",
  },
};

export default nextConfig;
