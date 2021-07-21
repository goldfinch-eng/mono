# Dockerfile for building `https://murmuration.goldfinch.finance` environment
# deployed to Google App Engine.

FROM node:12.18.3

RUN wget https://github.com/ethereum/solidity/releases/download/v0.6.8/solc-static-linux -O /bin/solc && chmod +x /bin/solc

RUN mkdir -p /goldfinch-protocol/client

WORKDIR /goldfinch-protocol

COPY . .

# Use the murmuration env config as `.env.local`.
ARG SENTRY_RELEASE
RUN cp ./murmuration/.env.murmuration ./.env.local
# Populate the config as necessary, for values known only at build time.
RUN sed -i -e "s/REACT_APP_SENTRY_RELEASE=REPLACE_ME_IN_BUILD/REACT_APP_SENTRY_RELEASE=${SENTRY_RELEASE}/g" ./.env.local
# Copy .env.local from the root dir to the client dir, replicating
# what the symlink from `./.env.local` to `./client/.env.local`
# accomplishes. (HACK: On the `murmuration-goldfinch-finance` branch which
# we deploy to the murmuration env, we have removed this symlink, because
# something about the symlink cause Google Cloud Build to error out, not on building
# the image, but in downloading the built image for deploying. Couldn't figure
# out any manipulation or replacement of this symlink that fixed the problem, so
# instead we remove the symlink from the branch entirely, so that it is never
# present in the Docker build context.)
RUN cp ./.env.local ./client/.env.local

# We observed `postinstall` not running automatically (which seems to be
# understood behavior in a Docker container: https://stackoverflow.com/q/47748075),
# so we run it manually.
RUN npm install && npm run postinstall

WORKDIR /goldfinch-protocol/client
# Replace the symlink at `client/.env.local` with its source file, as another
# way of accomplishing what the symlink does, since Docker seems not to respect
# the symlink.
RUN unlink ./.env.local && cp ../.env.local ./.env.local
RUN npm install

# Used by the Webpack dev server. See `murmuration()` in `client/config-overrides.js`.
EXPOSE 8080

WORKDIR /goldfinch-protocol
CMD npm run murmuration-start
