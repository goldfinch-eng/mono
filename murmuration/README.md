# Overview

`https://murmuration.goldfinch.finance` is a manual-testing environment that can be used by the entire team. In essence, it uses the same architecture as we use in local development, it's just running in the cloud.

It runs on a Google Compute Engine instance, and is deployed to continuously via Google Cloud Build upon pushing to the `murmuration-goldfinch-finance` branch. (This Google Cloud Build trigger was configured manually in the Cloud Build console.) It runs using the same services that we use in local development:
- the client is served by the Webpack dev server
- the blockchain is run via `npx hardhat node`
- the autotasks server runs via `npx hardhat run`
- it uses the `goldfinch-frontends-dev` Google Cloud functions, by default

Note: every deploy creates a new, mainnet-forked blockchain. So any blockchain state you might have created in using `https://murmuration.goldfinch.finance` will not persist across deploys.

# How to use

You can access the client at `https://murmuration.goldfinch.finance`.

To use the client with the murmuration blockchain, you will need to add a custom network in Metamask. The url of the custom network must be `https://murmuration.goldfinch.finance/_chain`. The chain id for the custom network must be 31337.
