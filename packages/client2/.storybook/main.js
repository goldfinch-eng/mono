const path = require("path");

module.exports = {
  core: {
    builder: "webpack5",
  },
  stories: [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)",
    "../components/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    {
      name: "@storybook/addon-postcss",
      options: {
        postcssLoaderOptions: {
          implementation: require("postcss"),
        },
      },
    },
  ],
  framework: "@storybook/react",
  webpackFinal: async (config) => {
    // This makes it so Storybook's Webpack instance resolves the "@" alias path from tsconfig the same way
    config.resolve.alias["@"] = path.resolve(__dirname, "..");

    const { rules } = config.module;
    const fileLoaderRule = rules.find(({ test }) => /.svg/.test(test));

    // Removes Storybook's default rule for loading SVGs so we can use SVGR instead
    // https://webpack.js.org/configuration/module/#condition
    fileLoaderRule.exclude = /\.svg$/;

    // These rules match what's in next.config.js
    rules.push({
      type: "asset",
      resourceQuery: /url/, // *.svg?url
    });
    rules.push({
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
