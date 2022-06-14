/* eslint-disable no-console */
import fs from "fs";
import path from "path";

console.log("Starting prepare-metadata.ts...");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextEnv = require("@next/env");
const env = nextEnv.loadEnvConfig(".");

const metadataNetwork = env.combinedEnv.NEXT_PUBLIC_POOL_METADATA_NETWORK;
const metadataIndexRelativePath = "../constants/metadata/index.ts";

if (metadataNetwork === "mainnet") {
  console.log("Connecting app to metadata from mainnet");
  const code = `import { mainnetMetadata } from "./mainnet";

export default mainnetMetadata;
`;

  fs.writeFileSync(path.resolve(__dirname, metadataIndexRelativePath), code);
} else if (metadataNetwork === "localhost") {
  console.log("Connecting app to metadata from local chain");
  const code = `import localhostMetadata from "./localhost.json";
import type { PoolMetadata } from "./types";

export default localhostMetadata as Record<string, PoolMetadata>;
`;

  fs.writeFileSync(path.resolve(__dirname, metadataIndexRelativePath), code);
} else {
  throw new Error(`Unknown metadata network: ${metadataNetwork}`);
}

console.log("Done prepare-metadata.ts");
