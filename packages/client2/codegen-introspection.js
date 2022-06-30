const codegenConfig = require("./codegen");

module.exports = {
  schema: codegenConfig.schema,
  documents: codegenConfig.documents,
  generates: {
    "lib/graphql/schema.json": {
      plugins: ["introspection"],
      config: {
        minify: true,
        descriptions: false,
      },
    },
  },
};
