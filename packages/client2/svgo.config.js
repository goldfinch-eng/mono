// For config options, see https://github.com/svg/svgo#configuration
module.exports = {
  js2svg: {
    indent: 2, // string with spaces or number of spaces. 4 by default
    pretty: true,
  },
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          removeViewBox: false,
        },
      },
    },
    "removeDimensions",
    {
      name: "sortAttrs",
      params: {
        xmlnsOrder: "alphabetical",
      },
    },
    {
      name: "prefixIds",
      params: {
        prefixIds: true,
        prefixClassNames: false, // mainly because this interferes with Spinner's gradient-spinner classname
      },
    },
  ],
};
