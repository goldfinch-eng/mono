FROM gitpod/workspace-base:latest

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

CMD while :; do sleep 2073600; done
