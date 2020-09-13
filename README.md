[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/goldfinch-eng/goldfinch-protocol)

# Goldfinch Protocol
Goldfinch is a lending protocol built on the blockchain. This is the main repo.

## Getting Started
**The Easy Way**: Click the gitpod link above, and start developing immediately from your browser. Done!

**The More Annoying, but Local Way**:
You will need the correct version of node/npm on your local machine.
- Using nvm, you can do this with `nvm install 12.18.3`. If you don't have `nvm`, see [here](https://github.com/nvm-sh/nvm#installing-and-updating) for installation instructions.
- Next install required packages of the protocol with `npm install`
- Then, if you want to install the front-end, `cd client && npm install`

### Front-end development
- See the README in the `client` folder.

### Getting Testnet ETH and USDC
You'll want some testnet ETH and USDC to play around with the app locally. Just pop your testnet adderss into the following sites to get some test cash. We use the `ropsten` testnet.

- https://faucet.ropsten.be/
- https://usdcfaucet.com/
  - Note, to see your test tokens on Metamask, you will need to add the Ropsted USDC Contract address. You can do so by following these steps:
  - Open Metamask and click `Add Token`
  - Then click the `Custom Token` tab on the right.
  - Then input the test contract address, which is `0x07865c6e87b9f70255377e024ace6630c1eaa37f`.

### Testing
- `npm test`

### Compiling Smart Contracts
- `npx buidler compile` (Though `npx buidler test` will compile automatically, so you generally shouldn't need to run this)

### Deployment
- Local deployments: These are only necessary when testing the front-end and are covered in the `client` folder README.
- Testnet deployments: 
    - Right now, we only support Ropsten testnets (because USDC only has testnet contracts there).
    - This will setup the main contracts as well as generate a credit line for the given user.
    - `TEST_USER={YOUR_METAMASK_ADDRESS} npx buidler deploy --network ropsten --export-all ./config/deployments.json`
- Mainnet deployments:
    - TBD

