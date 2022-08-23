/* eslint-disable @typescript-eslint/no-var-requires */
// import { Handler } from "@netlify/functions";
// import { createIPXHandler } from "@netlify/ipx";

// const functions = require("@netlify/functions");
const ipx = require("@netlify/ipx");

// const { builder } = functions.builder;
const { createIPXHandler } = ipx;

const standardHandler: any = createIPXHandler({});
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function

export const handler: any = (event: any, _context: any) => {
  // eslint-disable-next-line no-console
  console.log(`event: ${JSON.stringify(event)}`);
  const protocol = event.headers["x-forwarded-proto"] || "http";
  // eslint-disable-next-line no-console
  console.log(`protocol: ${protocol}`);
  if (!["http", "https"].includes(protocol)) {
    console.error(
      `malicious attacker attempting exploit via x-forwarded-proto: ${protocol}`
    );
    return Promise.resolve({ statusCode: 404, body: "Not Found" });
  } else {
    return standardHandler(event, _context);
  }
};
