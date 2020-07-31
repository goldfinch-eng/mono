# Goldfinch Protocol
Goldfinch is a lending protocol built on the blockchain. This is the main repo.

## Getting Started
You will need to install several "global" things first on your local machine.

- The correct version of node. You should do this through nvm with `nvm install 12.18.3`. If you don't have `nvm`, see [here](https://github.com/nvm-sh/nvm#installing-and-updating) for installation instructions.

- `npm install`

### Compiling Smart Contracts
- Run `npx oz compile`

### Running the front-end
- `cd client`
- `npm run start`

### Deploying smart contracts
- `npx oz deploy` and then follow the prompts

