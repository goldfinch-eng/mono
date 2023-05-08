/* eslint-disable @typescript-eslint/no-var-requires */

// These are managed by Defiance Analytics, our marketing partner
const gtmThirdPartyOrigins = [
  "https://www.googletagmanager.com",
  "https://googleads.g.doubleclick.net",
  "https://contentdsp.com",
  "https://s.rtpapp.net",
  "https://js.hs-scripts.com",
];

// Guidance for security headers: https://nextjs.org/docs/advanced-features/security-headers
// Note: we attempted to have a very restrictive connect-src and image-src, but the various third-party modules we use have so many external dependencies that it was difficult to list them all out (and they're subject to change without warning)
// ! script-src unsafe-inline is required for MetaMask to work. On FireFox the MetaMask extension is considered an inline script. Perplexingly, this is not the case on Chrome.
const ContentSecurityPolicy = `
  script-src 'self' 'unsafe-inline' ${gtmThirdPartyOrigins.join(" ")} ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : "" // Next.js devtools (like fast refresh) are eval'd scripts
  };
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com/;
  font-src 'self' https://fonts.gstatic.com/;
  frame-src 'self' https://withpersona.com/;
  frame-ancestors 'self' https://magic.store/;
`;
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/goldfinch_cms/**",
      },
      ...(process.env.NODE_ENV === "development"
        ? [{ hostname: "localhost" }]
        : []),
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/earn",
        permanent: false,
      },
      {
        source: "/verify",
        destination: "/account",
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
  webpack: (config, { isServer }) => {
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

    // Has to be added because the WalletConnect legacy client package causes build failures otherwise
    //* This can be removed when we move to WalletConnect v2 (which will happen when Impersonator and MetaMask mobile support it)
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

let enhancedNextConfig = withMDX(nextConfig);
if (process.env.SENTRY_AUTH_TOKEN) {
  enhancedNextConfig = withSentryConfig(
    enhancedNextConfig,
    sentryWebpackPluginOptions
  );
}
enhancedNextConfig = withBundleAnalyzer(enhancedNextConfig);
module.exports = enhancedNextConfig;
