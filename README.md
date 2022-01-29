# Goldfinch Protocol
Goldfinch is a decentralized lending protocol built on the blockchain. This is a monorepo containing Goldfinch's smart contracts, web3 frontend and other supporting code.

## Installing
#### Node version

You will need the correct version of node/npm on your local machine.

Using nvm, you can do this with `nvm install 12.18.3`. If you don't have `nvm`, see [here](https://github.com/nvm-sh/nvm#installing-and-updating) for installation instructions.

#### Packages

The repository is organized as a monorepo using [lerna](https://lerna.js.org/). Run the following to install lerna and then use it to install all package dependencies:

```shell
# Just the first time
npm install
npm run bootstrap
```

From here on out, every time you pull the repo and any packages change, you'll need to run

```shell
npm install
# Note use lerna bootstrap, and not npm run bootstrap. It's much faster
npx lerna bootstrap
```

## Developing

### Smart Contract Development
All contracts are located under `packages/protocol/contracts`
1. Make your changes
2. Write tests, which should be placed under `packages/protocol/test`
    - There are two kinds of tests. "Regular" (all local state) and "mainnet forking" (uses state from mainnet). They are located in different folders. Sometimes you write both for the same feature. Use your judgement depending on the change.
3. Write great commit messages, and put up your PR!

### Frontend Development
- `npm run start:local`
  - The simplest way to get going. All fresh, local state.
- `npm run start`
  - This will run a local, [mainnet-forked](https://hardhat.org/hardhat-network/guides/mainnet-forking.html) blockchain. Extremely useful for certain changes.
  - Requires an Alchemy API key. Sign up for free at https://www.alchemy.com/. To use it, see the one-time setup below.

Both options will start several processes, including your local blockchain and front-end server, which will pop up on http://localhost:3000. It takes a min to spin up.

#### One time setup (only necessary for front-end development)
- Ensure you have Java installed (Firebase emulator requires the JVM)
- Copy `.env.example` to `.env.local` (the local will be ignored by git).
- Add the following into your new `.env.local` file. Our local dev scripts will use these vars to automatically send you test ETH, and give you a credit line and USDC to play with.

  ```
  ALCHEMY_API_KEY={your alchemy api key}
  TEST_USERS={your metamask address}`
  ALLOWED_SENDERS={your metamask address}`
  ```

- If you want the `client` to use variables in your `.env.local`, create a symlink to this file from inside the `packages/client` dir, or else create a separate `packages/client/.env.local` file.

#### Running the front-end app

Changes to the frontend should be automatically hotloaded using react-refresh.

Changes to smart contracts will require re-compiling and re-deploying. You can do this by re-running your start command.

#### Other ways to run
* `npm run start:no-gasless` is available if gasless transactions are giving you trouble, or if you're having trouble finding the borrower contract address.

***Note** When running with `start:local`, the Fake USDC address that we create will also not be visible to Metamask by default. So you'll need to add this as well
by looking at the terminal output of the `@goldfinch-eng/protocol` start command. Search "USDC Address", and you should see something. Take that address, and
then go to `Add Token` in Metamask, and paste it in there. Your fake USDC balance should show up.


### Directory structure

* [`packages/`](./packages): Contains all typescript packages and contracts.
  * [`protocol/`](./packages/protocol) (`@goldfinch-eng/protocol`): Solidity smart contracts and tests.
  * [`client/`](./packages/client) (`@goldfinch-eng/client`): Web3 frontend using React.
  * [`functions/`](./packages/functions) (`@goldfinch-eng/functions`): Google cloud functions to support KYC and other server-side functionality.
  * [`autotasks/`](./packages/autotasks) (`@goldfinch-eng/functions`): [Defender Autotasks and Relay](https://docs.openzeppelin.com/defender/autotasks) code for supporting gasless transactions and triggering periodic on-chain calls.
  * [`utils/`](./packages/utils) (`@goldfinch-eng/utils`): Generally useful utilities that are shared across packages.
* [`murmuration/`](./murmuration): Provisioning scripts for our cloud staging environment, called Murmuration.

### Tenderly debugging
We have the ability to debug/profile local transactions via [Tenderly](Tenderly.co). To do this, get hold of a transaction hash and then run:

```bash
# Ensure tenderly-cli is installed via `brew tap tenderly/tenderly && brew install tenderly`
# And run this from the protocol directory
tenderly export --force <txhash>
```

To get a local transaction, run the app as normal, and make the transaction via the frontend, and get the hash from metamask after it's confirmed.

To get a test transaction, write a MainnetForking test, log the transaction hash in the test. Then run the mainnet forking test via:

```
# Run from the protocol directory
npm run test:tenderly
```

Pick up the transaction hash from the output of the test and run export as above

### Contributing
- See the [`CONTRIBUTING.MD`](./CONTRIBUTING.MD)

### Security
- See the [`SECURITY.MD`](./SECURITY.MD)

### Gasless transactions

To support gasless transactions, we need to collect the signature from the client, perform some server side checks to validate
the sender and receiving contract (e.g. it's a known borrower interacting with our borrower contracts, we don't want to subsidize any arbitrary transaction).
We use [Defender Relay](https://docs.openzeppelin.com/defender/relay) to do this. For local development, we mimic this by running a local server that executes the gasless logic.
We've configured webpack to proxy to this server when running `npm run start` for local development. If you're having problems with gasless transactions, make sure you've added your address to `.env.local`'s `ALLOWED_SENDERS`.

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

 Right now, we (sort-of) support Rinkeby testnet. We are already deployed there. However, it's not used much. Re-running deployment on Rinkeby is idempotent. But if we want to blow away the existing deployments for whatever reason, we can do the following:

Redeploy with: `TEST_USERS={YOUR_METAMASK_ADDRESS} npx buidler deploy --network {rinkeby} --export-all ./config/deployments.json --reset`

  Generally speaking, we only use Rinkeby to test deployment scripts in a more "real" setting. But we default to using mainnet forking for testing.

#### Mainnet deployments:

Contracts are already deployed to mainnet. We write custom scripts to do upgrades or deploy new contracts.

### Troubleshooting Frontend Issues

Front-end blockchain development is still early, and has rough edges. Here are some issues you might run into. If you see others, please add them here!

- `Authorization required` Make sure you have your Alchemy API key set in `.env.local`
- `Cannot set headers of undefined`. If you see this on the front-end, and the whole app blew up, then try switching your metamask off of the current network, and then back again (eg. to Ropsten and then back to Localhost)
- `Error: [ethjs-rpc] rpc error with payload`. This may look like a failed transaction, and Metamask is just throwing some random error with no help. If you're pretty sure everything should be fine, then try to shut down your local server, restart it, and then before you try any transactions, reset your Metamask account, and switch away and back to the local network (eg. local -> rinkeby -> local).
  To reset your Metamask account, click Metamask --> Settings --> Advanced --> Reset Account. This is fast and painless
- If Metamask is unable to / times-out while trying to connect to Localhost 8545: `rm deployments/localhost`, and then re-running `npm run start:local`, was observed to fix this problem and enable Metamask to connect.
- `Error: a provider or signer is needed to resolve ENS names`. You probably have an undefined address somewhere. But generally it means Ethers doesn't understand the address and is trying to interpret it as an ENS address.
