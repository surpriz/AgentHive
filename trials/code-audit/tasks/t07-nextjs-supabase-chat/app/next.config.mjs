/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Make the server-side Supabase settings available everywhere without prefixing each one.
  env: {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
};

export default nextConfig;
