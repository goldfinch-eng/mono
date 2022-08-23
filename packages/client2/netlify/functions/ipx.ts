import { createIPXHandler } from "@netlify/ipx";

export const handler = createIPXHandler({
  domains: ["beta.app.goldfinch.finance"],
});
