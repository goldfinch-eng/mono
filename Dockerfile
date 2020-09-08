FROM mhart/alpine-node:12.18.3

RUN apk update && apk add --no-cache --virtual build-dependencies git
RUN apk add python3
RUN wget https://github.com/ethereum/solidity/releases/download/v0.6.8/solc-static-linux -O /bin/solc && chmod +x /bin/solc

RUN mkdir -p /goldfinch-protocol
WORKDIR /goldfinch-protocol

COPY ./scripts/.bashrc.txt .
RUN cat bashrc.txt >> $HOME/.bashrc

# Then rest of code and build
COPY . /goldfinch-protocol

RUN apk del build-dependencies

CMD while :; do sleep 2073600; done
