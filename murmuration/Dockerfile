# Dockerfile for building `https://murmuration.goldfinch.finance` environment
# deployed to Google App Engine.

FROM node:12.18.3

RUN apt-get update
RUN wget https://github.com/ethereum/solidity/releases/download/v0.6.8/solc-static-linux -O /bin/solc && chmod +x /bin/solc

RUN mkdir -p /goldfinch-protocol/client

WORKDIR /goldfinch-protocol

COPY . .

# Use the murmuration env config as `.env.local`.
ARG SENTRY_RELEASE
RUN cp ./murmuration/.env.murmuration ./.env.local
# Populate the config as necessary, for values known only at build time.
RUN sed -i -e "s/REACT_APP_SENTRY_RELEASE=REPLACE_ME_IN_BUILD/REACT_APP_SENTRY_RELEASE=${SENTRY_RELEASE}/g" ./.env.local

# We observed `postinstall` not running automatically (which seems to be
# understood behavior in a Docker container: https://stackoverflow.com/q/47748075),
# so we run it manually.
RUN npm install && npm run postinstall

WORKDIR /goldfinch-protocol/client
RUN npm install

# Used by the Webpack dev server. See `murmuration()` in `client/config-overrides.js`.
EXPOSE 8080

WORKDIR /goldfinch-protocol
CMD npm run murmuration-start
