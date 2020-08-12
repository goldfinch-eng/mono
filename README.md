# Goldfinch Protocol
Goldfinch is a lending protocol built on the blockchain. This is the main repo.

## Getting Started
You will need the correct version of node/npm on your local machine.

- Using nvm, you can do this with `nvm install 12.18.3`. If you don't have `nvm`, see [here](https://github.com/nvm-sh/nvm#installing-and-updating) for installation instructions.

- Next install required packages of the protocol with `npm install`
- Then, `cd client && npm install`
- Then from the root, install the git pre-commit hooks `ln -s ./pre-commit.sh .git/hooks/pre-commit`

### Running a local blockchain
This is required for interacting with the contracts
- `npx ganache-cli --deterministic`


### Running the front-end
- `cd client`
- `npm install` (if needed)
- `npm run start`

### Compiling Smart Contracts
- `npx oz compile`

### Deploying smart contracts
- `npx oz deploy` and then follow the prompts

