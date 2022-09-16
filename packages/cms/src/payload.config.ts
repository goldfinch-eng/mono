import { buildConfig } from "payload/config";
import path from "path";

import Users from "./collections/Users";
import Borrowers from "./collections/Borrowers";
import Deals from "./collections/Deals";
import Media from "./collections/Media";

export const whitelist = [
  "http://localhost:3001",
  "http://localhost:3010",
  "https://app.goldfinch.finance/",
  "https://beta.app.goldfinch.finance/",
];

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_URL,
  admin: {
    user: Users.slug,
  },
  collections: [Users, Media, Borrowers, Deals],
  typescript: {
    outputFile: path.resolve(__dirname, "generated", "payload-types.ts"),
  },
  graphQL: {
    schemaOutputFile: path.resolve(
      __dirname,
      "generated",
      "generated-schema.graphql"
    ),
  },
  csrf: whitelist,
  cors: whitelist,
});
