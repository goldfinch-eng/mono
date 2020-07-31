FROM mhart/alpine-node:12.18.3

RUN apk update && apk add --no-cache --virtual build-dependencies git
RUN wget https://github.com/ethereum/solidity/releases/download/v0.7.0/solc-static-linux -O /bin/solc && chmod +x /bin/solc

RUN mkdir -p /goldfinch
WORKDIR /goldfinch

# First add deps
ADD ./package.json /goldfinch-protocol
ADD ./yarn.lock /goldfinch-protocol
RUN yarn install --lock-file

# Then rest of code and build
ADD . /goldfinch-protocol


RUN apk del build-dependencies
RUN yarn cache clean

CMD while :; do sleep 2073600; done
