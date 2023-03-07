<p align="center">
  <img src="banner.png" alt="Goldfinch Protocol icon" width="100%"/>
</p>

# Goldfinch Protocol

[Goldfinch](https://goldfinch.finance/) is a decentralized lending protocol built on the blockchain. This is a monorepo containing Goldfinch's smart contracts, web3 frontend, and other supporting code. For the latest documentation, check out our [docs](https://docs.goldfinch.finance/).

Stay up to date by joining our [Goldfinch Discord server](https://discord.com/invite/HVeaca3fN8) or following us on [Twitter @goldfinch_fi](https://twitter.com/goldfinch_fi).

## Software Development Set Up 

- Install [VSCode](https://code.visualstudio.com/download)
- Clone this repo to your local computer 
```bash
git clone https://github.com/warbler-labs/mono.git
``` 
When you open the project in a new VSCode window, a [pop up](https://dev.to/askrishnapravin/recommend-vs-code-extensions-to-your-future-teammates-4gkb#:~:text=Configuring%20recommended%20extensions&text=vscode%2F%20in%20the%20root%20of,tools(we%20use%20Git).) will display which will allow you to install all the recommended extensions for the repo. 

## Installation

Goldfinch requires NodeJS to get up and running. We recommend using [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) to manage the Node installation. Once nvm is installed, set up the environment from the project root by running
```bash
# setup Node using the version defined in .nvmrc
nvm install

# install yarn for package & workspace management
npm install --global yarn 
```

Now that the environment is set up, prepare the projects with

```bash
# install all dependencies
yarn install
```
This will also install Husky for utilizing Git Hooks.

At this point, you may wish to `yarn build:core` in order to build some of the commonly-used artifacts between packages. This will enable `yarn start:local` or `yarn start` if you are planning to use those.

### Other Requirements

For certain packages, you may also need to:

- Install `python` and add it to your path. Some of the dependencies require [node-gyp](https://github.com/nodejs/node-gyp), which compiles native addons using python. If you don't have `python`, we recommend using `pyenv`, which has instructions [here](https://github.com/pyenv/pyenv).
- Install `Java`. The frontend requires Java for the Firebase emulator.

## Monorepo

* [`packages/`](./packages): Contains all typescript packages and contracts.
  * [`protocol/`](./packages/protocol) (`@goldfinch-eng/protocol`): Solidity smart contracts and tests.
  * [`client2/`](./packages/client2) (`@goldfinch-eng/client2`): Web3 frontend using React.
  * [`subgraph/`](./packages/subgraph) (`@goldfinch-eng/subgraph`): Subgraph powering the frontend.
  * [`functions/`](./packages/functions) (`@goldfinch-eng/functions`): Google cloud functions to support KYC and other server-side functionality.
  * [`autotasks/`](./packages/autotasks) (`@goldfinch-eng/autotasks`): [Defender Autotasks and Relay](https://docs.openzeppelin.com/defender/autotasks) code for triggering periodic on-chain calls.
  * [`utils/`](./packages/utils) (`@goldfinch-eng/utils`): Generally useful utilities that are shared across packages.
  * [`docs/`](./packages/docs) (`@goldfinch-eng/docs`): Static site of protocol documentation.

## Smart Contract Development

All contracts are located under [`packages/protocol/contracts`](./packages/protocol/contracts/)

### Setup
Copy the `.env.example` at the workspace root to a new file `.env.local`. Fill in the `TEST_USER` field with some development address that you control.

### Testing
All tests should be under `packages/protocol/tests`. There are two kinds of tests. "Regular" (all local state) and "mainnet forking" (uses state from mainnet). They are located in different folders. Sometimes you write both for the same feature. Use your judgement depending on the change.

#### Mainnet Forking

Run `yarn test:mainnet-forking` in `packages/protocol`

#### Regular Tests

Run `forge test` in `packages/protocol`

If you don't already have Foundry installed:
- Install Foundry using the instructions here: https://github.com/foundry-rs/foundry
- Once installed, run the `foundry-tool.sh` script in `packages/protocol`
  - This will set up Foundry and prepare the git submodules
- In the future, you should run `forge install` in `packages/protocol` to update your forge dependencies.

#### Coverage 

Run `yarn test:coverage` in the protocol package to generate a coverage report for smart contract typescript tests. You can specify a set of files with a glob pattern, e.g. `yarn test:coverage -- --testfiles test/TranchedPool.test.ts`. See [soliditiy-coverage](https://github.com/sc-forks/solidity-coverage) for more info.

#### Tenderly debugging
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
yarn test:tenderly
```

Pick up the transaction hash from the output of the test and run export as above

### Compilation
Generally speaking, you shouldn't need to do this, since the test command automatically compiles. But if you need to independently compile, you can run:

```
yarn build
```

This will run `build` in all packages in the monorepo, including compiling the contracts. Beware this takes a long time to run, and if you don't have environment variables set up in every package that requires it, it may fail.

Alternatively, there's a lightweight version of `build`:
```
yarn build:core
```
This will build a handful of packages and get you ready to `yarn start:local` or `yarn start`.

## Frontend Development

The frontend is located in [`packages/client2`](./packages/client2/)

### Setup
Within [`packages/client2`](./packages/client2): 
1. Copy `.env.example` to `.env.local`
2. Find the following variables in `.env.local` and update them with your API key and EOA address. Our local dev scripts will use these to automatically send you test ETH, and give you a credit line and USDC to play with 
    ```js
    TEST_USER={your metamask address}

    // only necessary if running a mainnet-forked frontend
    ALCHEMY_API_KEY={your alchemy api key}
    ```

### Running
(Make sure you have run `yarn build:core` once before this)
- `yarn start:local`
  - The simplest way to get going. All fresh, local state.
- `yarn start`
  - This will run a local, [mainnet-forked](https://hardhat.org/hardhat-network/guides/mainnet-forking.html) blockchain. Extremely useful for certain changes.
  - Requires an Alchemy API key. Sign up for free at https://www.alchemy.com/.

Both options will start several processes, including your local blockchain and front-end server. It takes a min to spin up.

Once the services are running, go into `packages/client2` and run `yarn dev` to start the client.

Changes to the frontend should be automatically hotloaded using react-refresh, but changes to smart contracts will require re-compiling and re-deploying. You can do this by re-running your start command.

> **Note** When running with `start:local`, the Fake USDC address that we create will also not be visible to Metamask by default. So you'll need to add this as well
by looking at the terminal output of the `@goldfinch-eng/protocol` start command. Search "USDC Address", and you should see something. Take that address, and
then go to `Add Token` in Metamask, and paste it in there. Your fake USDC balance should show up.

## Contributing

See the [`CONTRIBUTING.MD`](./CONTRIBUTING.MD)

## Security

See the [`SECURITY.MD`](./SECURITY.MD)

## Deployment
### Local deployment
Contract deployment is handled automatically through the `yarn start` command, using [hardhat-deploy](https://github.com/wighawag/hardhat-deploy) and
custom build scripts in `packages/protocol/blockchain_scripts`.

### Mainnet deployments

Contracts are already deployed to mainnet. We write custom scripts to do upgrades or deploy new contracts.

## Troubleshooting

#### Unrecognized network name
Similar errors: Accounts array must not be empty, ADD_YOUR_METAMASK_ADDRESS_HERE

It's possible your local environment is not set up properly (or at all). You may need to create an .env.local file. Wherever these are needed, there is always an .env.example file that you can copy and rename.

See "One time setup" in "Frontend Development" for an example of this.

### Frontend

Front-end blockchain development is still early, and has rough edges. Here are some issues you might run into. If you see others, please add them here!

- `Authorization required` Make sure you have your Alchemy API key set in `.env.local`
- `Cannot set headers of undefined`. If you see this on the front-end, and the whole app blew up, then try switching your metamask off of the current network, and then back again (eg. to Mainnet and then back to Localhost)
- `Error: [ethjs-rpc] rpc error with payload`. This may look like a failed transaction, and Metamask is just throwing some random error with no help. If you're pretty sure everything should be fine, then try to shut down your local server, restart it, and then before you try any transactions, reset your Metamask account, and switch away and back to the local network (eg. local -> mainnet -> local).
  To reset your Metamask account, click Metamask --> Settings --> Advanced --> Reset Account. This is fast and painless
- If Metamask is unable to / times-out while trying to connect to Localhost 8545: `rm deployments/localhost`, and then re-running `yarn start:local`, was observed to fix this problem and enable Metamask to connect.
- `Error: a provider or signer is needed to resolve ENS names`. You probably have an undefined address somewhere. But generally it means Ethers doesn't understand the address and is trying to interpret it as an ENS address.

## Appendix

### Testing

For testing the whole repo, run `yarn test` from the root

### Testing UID Locally

- Start the app
- Connect with an account that is not golisted and no UID
- Navigate to `/verify`
- Use the DevTools and press the `kyc` and set `US`
- Use the DevTools to fund yourself with eth
- Refresh page, you should now be able to Create UID