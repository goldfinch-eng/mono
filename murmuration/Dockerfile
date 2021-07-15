# Dockerfile for building `https://murmuration.goldfinch.finance` environment
# deployed to Google App Engine.

# TODO It would be ideal to share the majority of these steps with `../gitpod.Dockerfile`,
# but currently that is impractical, because Docker does not have a notion
# like `INCLUDE`, to reuse logic across Dockerfiles: https://github.com/moby/moby/issues/735.
# Duplicating code is the 80/20 solution for now.

FROM node:12.18.3

RUN apt-get update
RUN apt-get --assume-yes install git less openssl python3
RUN wget https://github.com/ethereum/solidity/releases/download/v0.6.8/solc-static-linux -O /bin/solc && chmod +x /bin/solc

RUN mkdir -p /goldfinch-protocol/client

WORKDIR /goldfinch-protocol/client
COPY ./client/package.json .
COPY ./client/package-lock.json .
RUN npm install

WORKDIR /goldfinch-protocol
COPY ./package.json .
COPY ./package-lock.json .
RUN npm install

COPY . /goldfinch-protocol

# Used by the Webpack dev server. See `murmuration()` in `client/config-overrides.js`.
EXPOSE 8080
# Used by the Hardhat node.
EXPOSE 8545

CMD npm run start-murmuration
