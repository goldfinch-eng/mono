import { builder } from "@netlify/functions";
import { createIPXHandler } from "@netlify/ipx";

const standardHandler = createIPXHandler({});
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
const unbuiltHandler = (event, _context) => {
  const protocol = event.headers["x-forwarded-proto"] || "http";
  if (!["http", "https"].includes(protocol)) {
    console.error(
      `malicious attacker attempting exploit via x-forwarded-proto: ${protocol}`
    );
    return Promise.resolve({
      statusCode: 404,
      body: "Invalid protocol in x-forwarded-proto",
    });
  } else {
    return standardHandler(event, _context);
  }
};

export const handler = builder(unbuiltHandler);
