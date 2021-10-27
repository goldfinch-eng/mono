[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/goldfinch-eng/goldfinch-protocol)

# Goldfinch Protocol
Goldfinch is a lending protocol built on the blockchain. This is a monorepo containing Goldfinch's smart contracts, web3 frontend and other supporting code.

## Getting Started
### Cloud setup
We use Github Codespaces for cloud development. Goldfinch eng team members can simply click "Code" from the main repo page, and create a Codespace. Some key things to be aware of.
  - You can actually use your local VS Code instance (highly recommended) and connect directly to the cloud. You can also use a browser instance of VSCode if you like.
  - I would recommend going into your [personal codespace settings](https://github.com/settings/codespaces), and turning your Editor preference to "Visual Studio Code". This will default new Codespace instances to open up in your local VSCode, rather than the browser.
  - Choosing a 4-core machine is sufficient.

**Tips**
  - Codespaces has awesome "personalization" support through the use of `dotfiles` repos. If you set up a public repo called `dotfiles` under your Github handle, then Codespaces will automatically pull this in and run setup scripts, or use the bash_profile or what have you. It actually just takes all the files that start with `.` within that repo, and symlinks them to the Codespaces home directory. You can fork my dotfiles repo [here](https://github.com/blakewest/dotfiles) if you want.
  - Once forked (or if you have your own), then go to your [personal codespace settings](https://github.com/settings/codespaces) and turn on "Automatically import Dotfiles", and from then on it will "just work", and your coding experience will feel right at home.
  - Codespaces always use VSCode. But VS Code has plugins for 'vim mode" if you want that.

### Local setup

#### Node version

You will need the correct version of node/npm on your local machine.

Using nvm, you can do this with `nvm install 12.18.3`. If you don't have `nvm`, see [here](https://github.com/nvm-sh/nvm#installing-and-updating) for installation instructions.


#### Installing

The repository is organized as a monorepo using [lerna](https://lerna.js.org/). Run the following to install lerna and then use it to install all package dependencies:

```shell
npm install
npm run bootstrap
```

### Directory structure

* [`packages/`](./packages): Contains all typescript packages and contracts.
  * [`protocol/`](./packages/protocol) (`@goldfinch-eng/protocol`): Solidity smart contracts and tests.
  * [`client/`](./packages/client) (`@goldfinch-eng/client`): Web3 frontend using React.
  * [`functions/`](./packages/functions) (`@goldfinch-eng/functions`): Google cloud functions to support KYC and other server-side functionality.
  * [`autotasks/`](./packages/autotasks) (`@goldfinch-eng/functions`): [Defender Autotasks and Relay](https://docs.openzeppelin.com/defender/autotasks) code for supporting gasless transactions and triggering periodic on-chain calls.
  * [`utils/`](./packages/utils) (`@goldfinch-eng/utils`): Generally useful utilities that are shared across packages.
* [`murmuration/`](./murmuration): Provisioning scripts for our cloud staging environment, called Murmuration.

### Front-end development

#### One time setup

- Create a Goldfinch specific Metamask, which you can use for testing. The easiest way to do this is by creating a separate Chrome profile for Goldfinch, and then simply installing the Metamask extension.
- Ensure you have Java installed (Firebase emulator requires the JVM) -> *Not required if you use Codespaces*
- Copy `.env.example` to `.env.local` (the local will be ignored from git).
- Add the following into your new `.env.local` file. Our local dev scripts will use these vars to automatically send you test ETH, and give you a credit line and USDC to play with.

  ```
  TEST_USERS={your Goldfinch Metamask address}`
  ALLOWED_SENDERS=<your Goldfinch Metamask address>`
  ```

- If you want the `client` to use variables in your `.env.local`, create a symlink to this file from inside the `packages/client` dir, or else create a separate `packages/client/.env.local` file.

#### Running the stack

Run `npm run start` from the project root directory. This will:
  - Run a local, [mainnet-forked](https://hardhat.org/hardhat-network/guides/mainnet-forking.html) blockchain
  - Deploy our smart contracts
  - Set up useful state for the frontend (give your user a Credit Line, ETH, and USDC, etc.)
  - Create and deploy our subgraph to a local graph node
  - Start the front-end server, which will pop up on http://localhost:3000.

Changes to the frontend should be automatically hotloaded using react-refresh.

Changes to smart contracts will require re-compiling and re-deploying. You can do this by re-running `npm run start`.

Changes to the subgraph will also require re-deploying, to do this run `npm run deploy` from the subgraph directory.

#### Other ways to run
* `npm run start:no-gasless` is available if gasless transactions are giving you trouble, or if you're having trouble finding the borrower contract address.
* `npm run start:local` is available for running a non-forked local chain. The contracts will be deployed to a clean-slate, local blockchain.

***Note** When running with `start:local`, the Fake USDC address that we create will also not be visible to Metamask by default. So you'll need to add this as well
by looking at the terminal output of the `@goldfinch-eng/protocol` start command. Search "USDC Address", and you should see something. Take that address, and
then go to `Add Token` in Metamask, and paste it in there. Your fake USDC balance should show up.*

### Contributing
- See the [`CONTRIBUTING.MD`](./CONTRIBUTING.MD)

### Gasless transactions

To support gasless transactions, we need to collect the signature from the client, perform some server side checks to validate
the sender and receiving contract (e.g. it's a known borrower interacting with our borrower contracts, we don't want to subsidize any arbitrary transaction).
We use [Defender Relay](https://docs.openzeppelin.com/defender/relay) to do this. For local development, we mimic this by running a local server that executes the gasless logic.
We've configured webpack to proxy to this server when running `npm run start` for local development. If you're having problems with gasless transactions, make sure you've added your address to `.env.local`'s `ALLOWED_SENDERS`.

### Getting Testnet ETH and USDC

If you're going to test or develop on Testnet (eg. Ropsten, or Rinkeby), you'll want some testnet ETH and USDC to play around with the app locally. The following sites should work for the `ropsten` testnet.

- https://faucet.ropsten.be/
- https://usdcfaucet.com/
  - Note, to see your test tokens on Metamask, you will need to add the Ropsted USDC Contract address. You can do so by following these steps:
  - Open Metamask and click `Add Token`
  - Then click the `Custom Token` tab on the right.
  - Then input the test contract address, which is `0x07865c6e87b9f70255377e024ace6630c1eaa37f`.

### Testing
- Run `npm test` to run tests for all packages.
- Note if you want to only run tests for a particular test, then use `it.only` or `describe.only` inside the test file itself, which will focus to only those tests.
- If you want to run tests for a specific package, say just the protocol contracts, you can use lerna's `--scope` flag e.g. `npm run test -- --scope @goldfinch-eng/protocol`.

### Compiling Smart Contracts
Generally speaking, you shouldn't need to do this, since the test command automatically compiles. But if you need to independently compile, you can run:

```
npm run build
```

This will run `npm run build` in all packages in the monorepo, including compiling the contracts.

### Running tasks in the monorepo

Lerna provides commands to help run common tasks across the monorepo. Some of these commands have been encapsulated as scripts in the top-level `package.json`. For example, when we run `npm run test`, the underlying command is `npx lerna run tests`. This automatically runs `npm run test` in all subpackages that define an `test` npm script.

We can run lerna for a subset of packages using [globs](https://www.npmjs.com/package/glob). For example, to run tests for both the protocol and client (in parallel and with output), we can run:

```
npx lerna run test --stream --no-sort --scope "@goldfinch-eng/@(protocol|client)"
```

If we prefer using the top-level package.json scripts, we can achieve the same thing by running the following:

```
npm run test -- --no-sort --scope "@goldfinch-eng/@(protocol|client)"
```

For more info, have a look at `npx lerna run -h` and `npx lerna exec -h`.

### Deployment
#### Local deployment
Contract deployment is handled automatically through the `npm run start` command, using [hardhat-deploy](https://github.com/wighawag/hardhat-deploy) and
custom build scripts in `packages/protocol/blockchain_scripts`.

#### Testnet deployments

 Right now, we support Ropsten and Rinkeby testnets. We are already deployed to these. Re-running is idempotent. But if we want to blow away the existing deployments for whatever reason, we can do the following:

Redeploy with: `TEST_USERS={YOUR_METAMASK_ADDRESS} npx buidler deploy --network {ropsten|rinkeby} --export-all ./config/deployments.json --reset`

#### Mainnet deployments:

Contracts are already deployed to mainnet. We write custom scripts to do upgrades or deploy new contracts.

### Troubleshooting Frontend Issues

Front-end blockchain development is still early, and has rough edges. Here are some issues you might run into. If you see others, please add them here!

- `Cannot set headers of undefined`. If you see this on the front-end, and the whole app blew up, then try switching your metamask off of the current network, and then back again (eg. to Ropsten and then back to Localhost)
- `Error: [ethjs-rpc] rpc error with payload`. This may look like a failed transaction, and Metamask is just throwing some random error with no help. If you're pretty sure everything should be fine, then try to shut down your local server, restart it, and then before you try any transactions, reset your Metamask account, and switch away and back to the local network (eg. local -> rinkeby -> local).
  To reset your Metamask account, click Metamask --> Settings --> Advanced --> Reset Account. This is fast and painless
- `Incompatible EIP-155 v 134343 with Chain ID {some_id}`. If you see this, you probably created an incorrect Gitpod Local RPC network on Metamask. Check the settings of the network, and ensure you have the correct Chain ID, which should be 31337 for localhost. Or if you're on local host, go into Metamask --> Settings --> Network, and make sure your Chain ID is set to 31337
- If Metamask is unable to / times-out while trying to connect to Localhost 8545: `rm deployments/localhost`, and then re-running `npm run local-start`, was observed to fix this problem and enable Metamask to connect.
- `Error: a provider or signer is needed to resolve ENS names`. You probably have an undefined address somewhere. But generally it means Ethers doesn't understand the address and is trying to interpret it as an ENS address.
