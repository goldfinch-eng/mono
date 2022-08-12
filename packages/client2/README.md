# Goldfinch Frontend Client V2

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Important technologies

### Next.js

Next.js is basically a more comprehensive version of the ubiquitous Create React App. The additional features include: server-side rendering support, built-in API routes, image optimization, built-in router, and more! It's easy to learn and hard to go wrong with.

### Apollo

Apollo is one of the more fully-featured graphQL clients available. It goes quite far beyond just sending graphQL queries to a remote server. Notable features include: support for local resolvers, the ability to combine your remote server schema with a local schema, and the ability to program custom "Apollo links" (code that can transform a graphQL query before or after it is executed on the server).

### Redux vs Apollo

Managing global app state is a strongly-felt need for any non-trivial app. One of the common tools for this job is Redux, a library that allows you to express global app state as a function of a sequence of actions. Normally Redux would be adopted without a second thought, however, this app is also using Apollo and there is a fair bit of overlap in functionality between these two libraries. For the last couple of major releases, Apollo has touted itself as a complete state management solution. The features used to accomplish this are:

- The Apollo normalized cache. This was already a critical part of how Apollo stores data from a remote graphQL server and sends it to React components, but it can also be used as an app-wide store for the purpose of global state. You can use a local schema to add client-exclusive fields that the remote graphQL server has no knowledge of. **Think of this as the Redux store.**
- Local resolvers. These are graphQL resolvers that exist separate from your remote graphQL server, and they support async operations. The client can use these to enable queries for fields that only exist on the local schema. Local resolvers can also enable graphQL mutations that only affect the Apollo cache. **Local resolvers for `Query` types act as Redux selectors, local resolvers for `Mutation` types act as Redux actions. The logic inside these resolvers is like Redux reducers.** Resolvers have full access to the Apollo cache.
- Field policies. A simplified version of local resolvers that only support synchronous actions
- Reactive vars. Another way to read/write to the Apollo cache

After some debate, we decided to use Apollo for the purpose of global app state management in addition to its use as a graphQL client. The biggest advantage of this is:

- We can use graphQL to interface with Apollo and get a full view of local and remote state. As application developers, we only have to use **one single API for all of the app's data**. Developers do not have to wonder "should this new piece of data be part of Redux's responsibility, or Apollo's?" It is simply always Apollo, which reduces cognitive load and simplifies decisions. We've also eliminated a potential class of bug by choosing to just use Apollo: cross-cutting issues from making Apollo and Redux work together.

## Running locally

The easiest way to get the app running locally is by configuring it to consume mainnet data. Start by copying `client2/.env.example` to your own `client2/.env.local` file, and setting `NEXT_PUBLIC_NETWORK_NAME=mainnet`. This will configure the app to consume data from a mainnet subgraph, and use mainnet contract addresses for everything.

Running the app against a local chain is possible as well, but you need to set up a local subgraph for it. We do this by running a subgraph inside a Docker container. There are no known restrictions on Docker specs, but here are some sample specs that are known to work (as of June 23rd, 2022):

- Docker Desktop v4.8.2 (79419) (running on an Intel Mac)
- Engine: 20.10.14
- Compose: 1.29.2

To bring up the machines:

1. In the monorepo root, run `npm run start:local`. This will start up the local chain, the old client, and all of the other related processes. This will include the local GFI airdrops.
2. In `packages/subgraph`, run `npm run start-local`. This will bring up a subgraph in Docker. When Docker is up, run `npm run create-local` then `npm run deploy-local`
3. Finally, in this package, you can set `NEXT_PUBLIC_NETWORK_NAME=localhost` and you can comment out the env var for a graphQL URL if you have it. Now run `npm run dev`. This will start client2 on port 3001 so it doesn't conflict with the old client on port 3000.

## Guidelines and Conventions

### Directory structure

The top-level directories are as follows:

- `pages/` - This is where pages are located. Any file in here ending in `.page.tsx` will be a valid route in the webapp. For example, `pages/test.page.tsx` will be rendered at `http://localhost:3000/test`. Nesting a file in a subdirectory here will affect its route: `pages/foo/bar.page.tsx` will be rendered at `http://localhost:3000/foo/bar`. It's possible to create a page that has a dynamic segment in its URL using a unique Next.js convention. For example, `http://localhost:3000/pools/0xdeadbeef` could refer to `pages/pool/[poolAddress].page.tsx`. You can read more about this Next.js routing feature here: https://nextjs.org/docs/routing/dynamic-routes. Note that in this project, we have configured it such that only files ending in `.page.tsx` inside the `pages/` directory can be mapped to routes. This means you are free to place helper components for a page in an adjacent file. Example: `pages/foo/index.page.tsx`, `pages/foo/helpers.tsx` will only produce the page `http://localhost/foo`
- `components/design-system/` - This is where the app's shared components live. This place is meant for the UI primitives, such as buttons, links, modals, etc. Generally speaking, these components should be presentational only, meaning they shouldn't do any data-fetching. You can (and are encouraged to) write Storybook entries for your components here. We use the barrel-file convention in this repo for components. Treat each subdirectory in `components/` as its own module, and the `index.ts` file in that subdirectory should dictate what the module exports. For example:

```
design-system/
├── button
│   ├── button.stories.tsx // Storybook entries to show off the <Button> component
│   ├── button.tsx // This is where the actual definition of the component goes
│   └── index.tsx // This is where we determine what is exported from this module
```

- `components/` (outside of `design-system/`) this is the place for app-wide shared component that wouldn't be considered UI primitives. If there are widgets with complex behaviour that should be shared throughout the app, this is the place for them.
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

### Using TypeScript

- Avoid using `any`, there are always better alternatives. The linter is configured to disallow this.
- Explictly typing the return type of a function isn't strictly necessary, because type inference from the compiler is sufficient. However, if you feel that explicitly typing the return type of a function helps you make sure that you don't make any mistakes, then you are welcome to
- Aliasing React component prop types is recommended, it keeps things nice and legible

```jsx
interface ButtonProps {
  colorScheme: "red" | "green" | "blue"
}

function Button({ colorScheme }: ButtonProps) { // This area isn't oversaturated with type definitions
  ...
}
```

- Speaking of prop types, remember to always use `ReactNode` to describe the type of `children` in React, unless you're certain you want something less permissive, like `string` for example.
- Do not feel restricted to only putting one component per file. If you need to define a couple of minor helper components in a file, that's perfectly fine
- Use discriminated unions where possible. They definitely make your types more accurate

```ts
// very good
type NetworkLoadingState = {
  state: "loading";
};
type NetworkFailedState = {
  state: "failed";
  code: number;
};
type NetworkSuccessState = {
  state: "success";
  response: {
    title: string;
    duration: number;
    summary: string;
  };
};

type NetworkState =
  | NetworkLoadingState
  | NetworkFailedState
  | NetworkSuccessState;

// not as good
type NetworkState = {
  state: "loading" | "failed" | "success";
  code?: number;
  response?: {
    title: string;
    duration: number;
    summary: string;
  };
};
```

## Apollo local resolvers vs field policies

Local resolvers and field policies functionally overlap quite a bit. They let you use Apollo client to resolve a graphQL query that isn't supported by your server. This allows you to express app state in Apollo's global cache. Note that even though Apollo states that local resolvers are deprecated, they only mean local resolvers in their current available API. The level of functionality that local resolvers offer will be carried forward to future major releases of Apollo. The most significant difference between local resolvers and field policies is that local resolvers support async operations. So generally speaking, if you need to write an async operation to query a piece of app state, use a local resolver. Otherwise, use a field policy.

## Weird Things

### Emergencies with The Graph

There is one catastrophic emergency scenario that we all fear: our subgraph ingests a block that causes an indexing error, and the subgraph enters a failure state **with no code changes to the subgraph itself**. On The Graph, this means that the subgraph will stop syncing, and will give an error response to all further queries. This would mean our app experiences a total outage because our subgraph can no longer be queried. To make matters even worse, introspection queries result in an error as well, which makes building the app impossible because an introspection query is part of our prebuild process (it's seen inside `codegen.js`).

It seems like our only option in such a scenario is to debug our subgraph and re-index it to resolve the root error, all the while our app experiences painful downtime. **However**, we have taken steps to mitigate this by taking advantage of a feature called [Non-Fatal Errors](https://thegraph.com/docs/en/developer/create-subgraph-hosted/#non-fatal-errors).

1. The introspection result `lib/graphql/schema.json` can be generated from a local subgraph (the one you can run with Docker) and it can be temporarily committed to the repo. The schema generated from a local subgraph is fully compatible with the prod subgraph. If we need to deploy the app in this catastrophic scenario, follow the instructions inside `codegen.js` to make the app build with the (temporarily) committed copy of `schema.json`.
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
