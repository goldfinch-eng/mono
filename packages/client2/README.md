# Goldfinch Frontend Client V2

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Guidelines and Conventions

### Directory structure

The top-level directories are as follows:

- `pages/` - This is where pages are located. Any file in here ending in `.page.tsx` will be a valid route in the webapp. For example, `pages/test.page.tsx` will be rendered at `http://localhost:3000/test`. Nesting a file in a subdirectory here will affect its route: `pages/foo/bar.page.tsx` will be rendered at `http://localhost:3000/foo/bar`. It's possible to create a page that has a dynamic segment in its URL using a unique Next.js convention. For example, `http://localhost:3000/pools/0xdeadbeef` could refer to `pages/pool/[poolAddress].page.tsx`. You can read more about this Next.js routing feature here: https://nextjs.org/docs/routing/dynamic-routes. Note that in this project, we have configured it such that only files ending in `.page.tsx` inside the `pages/` directory can be mapped to routes. This means you are free to place helper components for a page in an adjacent file. Example: `pages/foo/index.page.tsx`, `pages/foo/helpers.tsx` will only produce the page `http://localhost/foo`
- `components/` - This is where the app's shared components live. This place is meant for the UI primitives, such as buttons, links, modals, etc. Generally speaking, these components should be presentational only, meaning they shouldn't do any data-fetching. You can (and are encouraged to) write Storybook entries for your components here. We use the barrel-file convention in this repo for components. Treat each subdirectory in `components/` as its own module, and the `index.ts` file in that subdirectory should dictate what the module exports. For example:

```
components/
├── button
│   ├── button.stories.tsx // Storybook entries to show off the <Button> component
│   ├── button.tsx // This is where the actual definition of the component goes
│   └── index.tsx // This is where we determine what is exported from this module
```

- `lib/` - This directory has a very broad scope, it's basically meant for "everything else". More specifically, it should contain code related to business logic in the app, such as handling wallet connections or setting up connections to smart contracts.
- `public/` - Any files placed in here will be hosted at the root of the webserver (exactly like create-react-app's `public/` directory). Please refrain from placing image files in here, because we have this project configured to allow images to be imported in code as if they were modules, so they can live much closer to the source code that requires them.
- `styles/` - This is for app-level CSS. Tailwind's entrypoint CSS file lives in here. There shouldn't be a need to add any additional files here.
- `stories/` - This is for app-level Storybook entries that aren't specific to any one component in `components/`
- `types/` - Global type declarations go in here. Notably, this is where Typechain types are placed when they are generated.
- `scripts/` - Custom scripts that are _not_ executed during application runtime. Think prebuild scripts. These can be written in TypeScipt and executed with `ts-node` (installed as a devDependency here)

### Filenames

- Name files using `kebab-casing`. This rule goes for all files. It's easy and it's one less thing to think about. React component definitions still need to be `PascalCased`, and hooks still need to be `camelCased`, but their filenames can always be `kebab-cased`.
- Use `@/` as an alias for the root of this project. It's like having absolute paths. `import { Button } from "@/components/design-system";

### Icons

- Importing SVGs as React components is enabled for this repo (using SVGR). You can do this:

```
import MySvg from "./my-svg.svg";

<MySvg />
```

SVGO is also available for reducing SVG file sizes. It runs automatically when you import SVGs, but it's also good to run it manually on SVG files: `npx svgo ./path/to/my/svg`. It has some sane defaults configured on it, like prettifying markup and enforcing the use of `viewBox`

- If you're adding a new primitive icon (the single-tone icons that appear throughout the UI), it should go in `compontents/icon`. Add the .svg file in `svg/`, import it in `icon.tsx` and make it available in the `iconManifest`. Then you can use it like so `<Icon name="MyNewIcon" />`

### GraphQL and Apollo

This project uses Apollo client for fetching data from a remote GraphQL server (our subgraph in The Graph), and also for synthesizing it with local data to form a complete global app state. To put it another way, the Apollo cache is meant to be the source of truth for global app state, and will contain data from outside The Graph. All data inside the Apollo cache is accessible via GraphQL queries. Note that the remote schema from our The Graph subgraph is combined with a client-only schema in this app (`client-only-schema.graphql`).

We also use `graphql-codegen` to generate TypeScript types for our GraphQL schema and queries.

## Weird Things

### Emergencies with The Graph

There is one catastrophic emergency scenario that we all fear: our subgraph ingests a block that causes an indexing error, and the subgraph enters a failure state **with no code changes to the subgraph itself**. On The Graph, this means that the subgraph will stop syncing, and will give an error response to all further queries. This would mean our app experiences a total outage because our subgraph can no longer be queried. To make matters even worse, introspection queries result in an error as well, which makes building the app impossible because an introspection query is part of our prebuild process (it's the `codegen-introspection` script in package.json).

It seems like our only option in such a scenario is to debug our subgraph and re-index it to resolve the root error, all the while our app experiences painful downtime. **However**, we have taken steps to mitigate this by taking advantage of a feature called [Non-Fatal Errors](https://thegraph.com/docs/en/developer/create-subgraph-hosted/#non-fatal-errors).

1. The introspection result `lib/graphql/schema.json` has been committed to the repo, so we always have a backup of it. If we need to deploy the app in this catastrophic scenario, we can disable the introspection step by (temporarily) removing the `precodegen` step in our package.json scripts. This will cause the build system to just use the committed schema instead of trying to fetch a fresh one from The Graph.
2. (and more importantly), we have made our queries tolerant to this scenario on The Graph by using the Non-Fatal Errors feature. We accomplished this by writing a custom Apollo Link that always adds the `subgraphError: allow` argument to our queries so that they will be able to get information from The Graph even if it enters a failure state (although the data will be stale). Developers do not have to be conscious of this argument when writing queries, it is added automatically.

#2 has one important impact on how you should handle data from queries: by default, the `errorPolicy` in Apollo is set to `"all"`, meaning that you can have `data` and `error` populated at the same time, so please plan around this. `error` being populated does not mean that `data` will be undefined (unless of course you override the errorPolicy for your particular query, which is perfectly fine).
### Webpack 5

Next.js has long-adopted Webpack5 as their default, but unfortunately Storybook is lagging behind. There would be some nasty conflicts if we had Storybook operating with Webpack 4 while the rest of the project was written with Webpack 5 in mind. The first and most obvious one would be some Webpack loaders being unusable in Storybook if they're written for Webpack 5 (like SVGR). Fortunately, Storybook has experimental support for Webpack 5 but it turned out to be a little buggy. It was implemented following this note: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#webpack-5. It didn't work right away and we ended up having to add `webpack@5` as a dev dependency to this project to ensure Storybook hoisted it correctly. It works now, but we have this silly-looking `webpack@5` devDependency in the project. It's harmless, but just be aware of it. Hopefully Storybook will fully move on from Webpack 4 and this issue will resolve itself.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.
