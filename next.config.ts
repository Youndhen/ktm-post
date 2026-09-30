/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  staticPageGenerationTimeout: 120,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.ktmpost.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.onlinekhabar.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets-cdn-api.ekantipur.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets-cdn.ekantipur.com",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
