# Dockerfile for building `https://murmuration.goldfinch.finance` environment
# deployed to Google App Engine.

FROM node:12.18.3

RUN apt-get update
RUN apt-get --assume-yes install git less openssl python3
RUN wget https://github.com/ethereum/solidity/releases/download/v0.6.8/solc-static-linux -O /bin/solc && chmod +x /bin/solc

RUN mkdir -p /goldfinch-protocol/client

WORKDIR /goldfinch-protocol
COPY . .
# We observed `postinstall` not running automatically (which seems to be
# understood behavior in a Docker container: https://stackoverflow.com/q/47748075),
# so we run it manually.
RUN npm install && npm run postinstall

WORKDIR /goldfinch-protocol/client
RUN npm install

# Used by the Webpack dev server. See `murmuration()` in `client/config-overrides.js`.
EXPOSE 8080
# Used by the Hardhat node.
EXPOSE 8545

WORKDIR /goldfinch-protocol
CMD npm run start-murmuration
