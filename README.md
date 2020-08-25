# Goldfinch Protocol
Goldfinch is a lending protocol built on the blockchain. This is the main repo.

## Getting Started
You will need the correct version of node/npm on your local machine.

- Using nvm, you can do this with `nvm install 12.18.3`. If you don't have `nvm`, see [here](https://github.com/nvm-sh/nvm#installing-and-updating) for installation instructions.

- Next install required packages of the protocol with `npm install`
- Then from the root, install the git pre-commit hooks `ln -s ./pre-commit.sh .git/hooks/pre-commit`
- Then, if you want to install the front-end, `cd client && npm install`

### Running a local blockchain
This is required for interacting with the contracts
- `npx buidler node`

### Getting Testnet ETH and USDC
You'll want some testnet ETH and USDC to play around with the app locally. Just pop your testnet adderss into the following sites to get some test cash. We use the `ropsten` testnet.

- https://faucet.ropsten.be/
- https://usdcfaucet.com/
  - Note, to see your test tokens on Metamask, you will need to add the Ropsted USDC Contract address. You can do so by following these steps:
  - Open Metamask and click `Add Token`
  - Then click the `Custom Token` tab on the right.
  - Then input the test contract address, which is `0x07865c6e87b9f70255377e024ace6630c1eaa37f`.

### Running the front-end
- `cd client`
- `npm install` (if needed)
- `npm start`

### Testing
- `npm test`

### Compiling Smart Contracts
- `npx buidler compile` (Though `npx buidler test` will compile automatically, so you generally shouldn't need to run this)

### Deploying smart contracts
- If you want to deploy for local testing purposes, then see the front-end README in `client/README.md` and look under "developing".

