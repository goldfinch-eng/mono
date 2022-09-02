/* eslint-disable @typescript-eslint/no-var-requires */

const ContentSecurityPolicy = `
  frame-ancestors 'self';
`;
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Content-Security-Policy",
    // https://nextjs.org/docs/advanced-features/security-headers#content-security-policy
    // Replace two spaces with one then trim trailing and leading whitespace
    value: ContentSecurityPolicy.replace(/\s{2,}/g, " ").trim(),
  },
];
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
const withMDX = require("@next/mdx")({
  // reference for MDX in Next: https://nextjs.org/docs/advanced-features/using-mdx
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});
const { withSentryConfig } = require("@sentry/nextjs");
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, org, project, authToken, configFile, stripPrefix,
  //   urlPrefix, include, ignore

  silent: true, // Suppresses all logs
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options.
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: [
    "page.tsx",
    "page.ts",
    "page.jsx",
    "page.js",
    "page.mdx",
    "page.md",
  ],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/earn",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
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
    // Allows .graphql files to be imported literally
    config.module.rules.push({
      test: /\.graphql$/i,
      issuer: /\.[jt]sx?$/,
      type: "asset/source",
    });

    return config;
  },
};

module.exports = withBundleAnalyzer(
  withSentryConfig(withMDX(nextConfig), sentryWebpackPluginOptions)
);
