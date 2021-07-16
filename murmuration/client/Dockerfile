# Dockerfile for building `https://murmuration.goldfinch.finance` environment
# deployed to Google App Engine.

FROM $BASE_IMAGE

WORKDIR /goldfinch-protocol/client
RUN npm install

EXPOSE 8080

WORKDIR /goldfinch-protocol
CMD npm run murmuration-start-client
