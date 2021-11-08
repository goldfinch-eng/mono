# Dockerfile for building the `https://murmuration.goldfinch.finance` application
# deployed to Google Compute Engine.

FROM node:12.18.3

RUN wget https://github.com/ethereum/solidity/releases/download/v0.6.8/solc-static-linux -O /bin/solc && chmod +x /bin/solc

# Install Java 8 (cf. https://stackoverflow.com/a/49914935). This is needed by the Firestore emulator.
RUN apt-get update && apt-get -y --fix-missing install software-properties-common
RUN \
  echo oracle-java8-installer shared/accepted-oracle-license-v1-1 select true | debconf-set-selections && \
  add-apt-repository -y ppa:webupd8team/java && \
  apt-get update && \
  apt-get install -y oracle-java8-installer --allow-unauthenticated && \
  rm -rf /var/lib/apt/lists/* && \
  rm -rf /var/cache/oracle-jdk8-installer
ENV JAVA_HOME /usr/lib/jvm/java-8-oracle

# Install Google Cloud SDK (cf. https://stackoverflow.com/a/28372329)
RUN curl https://dl.google.com/dl/cloudsdk/release/google-cloud-sdk.tar.gz > /tmp/google-cloud-sdk.tar.gz
RUN mkdir -p /usr/local/gcloud \
  && tar -C /usr/local/gcloud -xvf /tmp/google-cloud-sdk.tar.gz \
  && /usr/local/gcloud/google-cloud-sdk/install.sh --quiet
ENV PATH $PATH:/usr/local/gcloud/google-cloud-sdk/bin

# Install the Firestore emulator, which is necessary for running Google Cloud functions locally.
RUN gcloud components install cloud-firestore-emulator beta --quiet

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
