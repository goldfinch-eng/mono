# Website

This website is built using [Docusaurus 2](https://docusaurus.io/), a modern static website generator.

### Installation

From the repo root:
```
$ npm run bootstrap
```

### Local Development

#### To generate Markdown docs from our Solidity smart contracts:

From `packages/docs`:
```
$ npm run build-solidity-docs
```

#### To run docs app:

From `packages/docs`:
```
$ npm run start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

From `packages/docs`:
```
$ npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.
