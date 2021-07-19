# Dockerfile for building `https://murmuration.goldfinch.finance` environment
# deployed to Google App Engine.

ARG BASE_IMAGE
FROM $BASE_IMAGE

EXPOSE 8080

WORKDIR /goldfinch-protocol
CMD npm run murmuration-start-chain
