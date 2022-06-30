/* eslint-disable no-console */
import fs from "fs";
import path from "path";

console.log("Starting prepare-metadata.ts for pool metadata...");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextEnv = require("@next/env");
const env = nextEnv.loadEnvConfig(".");

const metadataNetwork = env.combinedEnv.NEXT_PUBLIC_NETWORK_NAME;
const metadataIndexRelativePath = "../constants/metadata/index.ts";
const metadataFilePath = path.resolve(__dirname, metadataIndexRelativePath);

if (metadataNetwork === "mainnet") {
  console.log("Connecting app to metadata from mainnet");
  const code = `import { mainnetMetadata } from "./mainnet";

export default mainnetMetadata;
`;

  fs.writeFileSync(metadataFilePath, code);
} else if (metadataNetwork === "localhost") {
  console.log("Connecting app to metadata from local chain");
  const code = `import localhostMetadata from "./localhost.json";
import type { PoolMetadata } from "./types";

export default localhostMetadata as Record<string, PoolMetadata>;
`;

  fs.writeFileSync(metadataFilePath, code);
} else if (metadataNetwork === "murmuration") {
  console.log("Connecting app to metadata from murmuration");
  const code = `import murmurationMetadata from "./murmuration.json";
import type { PoolMetadata } from "./types";

export default murmurationMetadata as Record<string, PoolMetadata>;
`;

  fs.writeFileSync(metadataFilePath, code);
} else {
  throw new Error(`Unknown metadata network: ${metadataNetwork}`);
}

console.log(
  `Done prepare-metadata.ts, wrote pool metadata to file: ${metadataFilePath}`
);
