const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias["@agents"] = path.resolve(__dirname, "../agents/lib");
    // Allow agents/ to resolve packages from frontend's node_modules
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      "node_modules",
    ];
    return config;
  },
};

module.exports = nextConfig;
