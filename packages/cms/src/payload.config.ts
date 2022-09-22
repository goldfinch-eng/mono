import { buildConfig } from "payload/config";
import { cloudStorage } from "@payloadcms/plugin-cloud-storage";
import { gcsAdapter } from "@payloadcms/plugin-cloud-storage/gcs";
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

// Local filesystem will be used if the env var for GCS bucket is not set. Can be used for running the CMS on local machine.
const adapter = process.env.GCS_BUCKET
  ? gcsAdapter({
      options: {
        apiEndpoint: process.env.GCS_ENDPOINT,
        projectId: process.env.GCS_PROJECT_ID,
      },
      bucket: process.env.GCS_BUCKET,
    })
  : null;

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_URL,
  admin: {
    user: Users.slug,
    webpack: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          "@payloadcms/plugin-cloud-storage": "./mocks/plugin-cloud-storage", // mocks out the entire cloud storage plugin. there's an issue where it causes the Payload frontend to not build
        },
      },
    }),
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
  plugins: [
    cloudStorage({
      collections: {
        media: {
          adapter,
        },
      },
    }),
  ],
  csrf: whitelist,
  cors: whitelist,
});
