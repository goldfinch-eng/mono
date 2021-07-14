# Dockerfile for building `https://testing.goldfinch.finance` environment
# deployed to Google Cloud Run.

# TODO It would be ideal to share the majority of these steps with `gitpod.Dockerfile`,
# but currently that is impractical, because Docker does not have a notion
# like `INCLUDE`, to reuse logic across Dockerfiles: https://github.com/moby/moby/issues/735.
# Duplicating code is the 80/20 solution for now.

FROM mhart/alpine-node:12.18.3

RUN apk update && apk add --no-cache --virtual build-dependencies git
RUN apk --update add git less openssh
RUN apk add python3
RUN wget https://github.com/ethereum/solidity/releases/download/v0.6.8/solc-static-linux -O /bin/solc && chmod +x /bin/solc

RUN mkdir -p /goldfinch-protocol
WORKDIR /goldfinch-protocol

# First add deps
COPY ./package.json .
COPY ./package-lock.json .
RUN npm install

RUN mkdir -p /client
COPY ./client/package.json ./client
COPY ./client/package-lock.json ./client
WORKDIR /client
RUN npm install

WORKDIR /goldfinch-protocol

# Then rest of code and build
COPY . /goldfinch-protocol
RUN cat ./bashrc.txt >> $HOME/.bashrc

RUN apk del build-dependencies

CMD npm start-without-client
