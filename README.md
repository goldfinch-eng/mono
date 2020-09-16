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
- `TEST_USER={YOUR_METAMASK_ADDRESS} npm start` from the project root directory.
  - This will run a local blockchain, deploy the contracts, and set up useful state for the frontend (give your user a Credit Line and fake ETH, and fake USDC, etc.)
  - It will also start the front-end server, which will pop up on localhost 3000

**IMPORTANT** Since we use Gitpod, the local blockchain that gets spun up will not be visible to Metamask by default. So if you try to join
"localhost 8545", it will not connect. You can fix this by creating a custom network on Metamask that points to the open port on your Gitpod instance.
This is easy. 
  1.) Open the Gitpod front-end in the browser, 
  2.) Copy that url, and you should see a `3000` at the beginning of it. Change that to `8545`
  3.) Open Metamask, and click `Custom RPC`. Paste in that url from step 2 into the `New RPC URL` area.
  4.) Hit save. You're done.

**Also Good to Know** The Fake USDC address that we create will also not be visible to Metamask by default. So you'll need to add this as well
by looking at the terminal output of the `npx buidler node` command. Search "USDC Address", and you should see something. Take that address, and 
then go to `Add Token` in Metamask, and paste it in there. Your fake USDC balance should show up.

- That's pretty much it! Make your changes. The local server will auto reload

### Getting Testnet ETH and USDC
If you're going to test or develop on Testnet (eg. Ropsten, or Rinkeby), you'll want some testnet ETH and USDC to play around with the app locally. The following sites should work for the `ropsten` testnet.

- https://faucet.ropsten.be/
- https://usdcfaucet.com/
  - Note, to see your test tokens on Metamask, you will need to add the Ropsted USDC Contract address. You can do so by following these steps:
  - Open Metamask and click `Add Token`
  - Then click the `Custom Token` tab on the right.
  - Then input the test contract address, which is `0x07865c6e87b9f70255377e024ace6630c1eaa37f`.

### Testing
- `npm test`
- Note if you want to only run tests for a particular test, then use `it.only` or `describe.only` inside the test file itself, which will focus to only those tests.

### Compiling Smart Contracts
Generally speaking, you shouldn't need to do this, since the test command automatically compiles. But if you need to independently compile:
- `npx buidler compile`

### Deployment
- Local deployments are handled through the `npm start` command.
- Testnet deployments: 
    - Right now, we support Ropsten and Rinkeby testnets.
    - We are already deployed to these. Re-running is idempotent. But if we want to blow away the existing deployments for whatever reason, we can do the following:
    - delete the `deployments/{network}` folder.
    - Redeploy with: `TEST_USER={YOUR_METAMASK_ADDRESS} npx buidler deploy --network {ropsten|rinkeby} --export-all ./config/deployments.json`
- Mainnet deployments:
    - TBD

