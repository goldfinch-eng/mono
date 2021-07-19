# Dockerfile for building the base Docker image used by the murmuration `chain` and
# `client` images.

FROM node:12.18.3

RUN apt-get update
RUN wget https://github.com/ethereum/solidity/releases/download/v0.6.8/solc-static-linux -O /bin/solc && chmod +x /bin/solc

RUN mkdir -p /goldfinch-protocol/client

WORKDIR /goldfinch-protocol
COPY . .

# Use the murmuration env config as `.env.local`.
RUN cp ./murmuration/base/.env.murmuration ./.env.local

# We observed `postinstall` not running automatically (which seems to be
# understood behavior in a Docker container: https://stackoverflow.com/q/47748075),
# so we run it manually.
RUN npm install && npm run postinstall

# Run hardhat's deploy process. We want to do this in the base Docker image shared by both
# the `chain` and `client` App Engine services, so that they can both leverage the
# same `deployments_dev.json` file that is the output of `npm run murmuration-deploy`.
RUN npm run murmuration-deploy
