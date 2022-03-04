/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Note that this function can have more arguments. See https://nextjs.org/docs/api-reference/next.config.js/custom-webpack-config
  webpack: (config) => {
    // Allows SVGs to be imported as plain URLs if written as follows: import svg from './assets/file.svg?url'
    // See https://react-svgr.com/docs/webpack/#use-svgr-and-asset-svg-in-the-same-project
    config.module.rules.push({
      type: "asset",
      resourceQuery: /url/, // *.svg?url
    });
    // Allows SVGs to be imported as React components
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: [
        {
          loader: "@svgr/webpack",
          // https://react-svgr.com/docs/options/
          options: {
            memo: true,
            svgo: true,
            ref: true,
            titleProp: true,
          },
        },
      ],
    });

    return config;
  },
};

module.exports = nextConfig;
