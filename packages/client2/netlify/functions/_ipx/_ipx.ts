/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */

const ipx = require("@netlify/ipx");
const { createIPXHandler } = ipx;
// const standardHandler: any = createIPXHandler({});
export const handler: any = async (event: any, _context: any) => {
  console.log(`event: ${JSON.stringify(event)}`);
  const protocol = event.headers["x-forwarded-proto"] || "http";
  console.log(`protocol: ${protocol}`);
  if (!["http", "https"].includes(protocol)) {
    console.error(
      `malicious attacker attempting exploit via x-forwarded-proto: ${protocol}`
    );
    return { statusCode: 404, body: "Not Found" };
  } else {
    // return standardHandler(event, _context);
  }
};
