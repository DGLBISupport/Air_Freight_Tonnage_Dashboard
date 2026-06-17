/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export as fully static HTML/CSS/JS — served by FastAPI on Cloud Run
  output: 'export',
  // Ensures index.html is created for each route folder
  trailingSlash: true,
  // Image optimization is not available in static export mode
  images: {
    unoptimized: true,
  },
  // Skip type-checking and linting during build (speeds up Docker build)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
