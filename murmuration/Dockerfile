# Dockerfile for building the `https://murmuration.goldfinch.finance` application
# deployed to Google Compute Engine.

FROM node:12.18.3

RUN wget https://github.com/ethereum/solidity/releases/download/v0.6.8/solc-static-linux -O /bin/solc && chmod +x /bin/solc

WORKDIR /goldfinch-protocol

COPY . .

# Use the murmuration env config as `.env.local`.
ARG SENTRY_RELEASE
RUN cp ./murmuration/.env.murmuration ./.env.local
# Populate the config as necessary, for values known only at build time.
RUN sed -i -e "s/REACT_APP_SENTRY_RELEASE=REPLACE_ME_IN_BUILD/REACT_APP_SENTRY_RELEASE=${SENTRY_RELEASE}/g" ./.env.local
# Copy .env.local to the client dir, so the client can use its variables.
RUN cp ./.env.local ./packages/client/.env.local

# We observed `postinstall` not running automatically (which seems to be
# understood behavior in a Docker container: https://stackoverflow.com/q/47748075),
# so we run it manually.
RUN npm install && npm run bootstrap && npx lerna run postinstall

# Used by the Webpack dev server. See `murmuration()` in `client/config-overrides.js`.
EXPOSE 80

CMD npm run start:murmuration:liquidity-mining
