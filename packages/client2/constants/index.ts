import { BigNumber } from "ethers";

export * from "./contract-addresses";
export { default as BORROWER_METADATA } from "@/cms-cache/borrowers.json";
export { default as POOL_METADATA } from "@/cms-cache/deals.json";

const networkName = process.env.NEXT_PUBLIC_NETWORK_NAME as string;
if (!networkName) {
  throw new Error("Network name is not defined in env vars");
}
export const DESIRED_CHAIN_ID =
  networkName === "mainnet" ? 1 : networkName === "murmuration" ? 31337 : 31337;

export const USDC_DECIMALS = 6;
export const USDC_MANTISSA = BigNumber.from(10).pow(USDC_DECIMALS);
export const GFI_DECIMALS = 18;
export const FIDU_DECIMALS = 18;
export const CURVE_LP_DECIMALS = 18;
export const CURVE_LP_MANTISSA = BigNumber.from(10).pow(CURVE_LP_DECIMALS);

const PARALLEL_MARKETS_API_URL =
  process.env.NEXT_PUBLIC_NETWORK_NAME === "localhost"
    ? "https://demo-api.parallelmarkets.com/v1"
    : process.env.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? "https://demo-api.parallelmarkets.com/v1" /* will change this to: "https://api.parallelmarkets.com/v1" before shipping */
    : "";

if (PARALLEL_MARKETS_API_URL === "") {
  throw new Error("Could not determine Parallel Markets API URL");
}

const PARALLEL_MARKETS_CLIENT_ID = process.env
  .NEXT_PUBLIC_PARALLEL_MARKETS_CLIENT_ID as string;

if (!PARALLEL_MARKETS_CLIENT_ID) {
  throw new Error("Parallel Markets Client ID was not provided");
}

export const PARALLEL_MARKETS = {
  API_URL: PARALLEL_MARKETS_API_URL,
  CLIENT_ID: PARALLEL_MARKETS_CLIENT_ID,
  SCOPE: "accreditation_status profile identity",
  STATE_KEY: "parallel_markets_state_key",
};

export const SETUP_UID_BANNER_TEXT =
  "Unique Identity (UID) is a non-transferrable NFT representing KYC-verification on-chain. A UID is required to participate in the Goldfinch lending protocol. No personal information is stored on-chain.";

export const TRANCHES = {
  Senior: 1,
  Junior: 2,
};

export const SUBGRAPH_API_URL =
  typeof process.env.NEXT_PUBLIC_GRAPHQL_URL !== "undefined"
    ? process.env.NEXT_PUBLIC_GRAPHQL_URL
    : process.env.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? "https://api.thegraph.com/subgraphs/name/goldfinch-eng/goldfinch-v2"
    : process.env.NEXT_PUBLIC_NETWORK_NAME === "localhost"
    ? "http://localhost:8000/subgraphs/name/goldfinch-subgraph"
    : "";
if (SUBGRAPH_API_URL === "") {
  throw new Error("Could not determine GraphQL API URL");
}

export const CMS_API_URL =
  typeof process.env.NEXT_PUBLIC_CMS_GRAPHQL_API_URL !== "undefined"
    ? process.env.NEXT_PUBLIC_CMS_GRAPHQL_API_URL
    : process.env.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? "http://cms.goldfinch.finance/api/graphql"
    : process.env.NEXT_PUBLIC_NETWORK_NAME === "localhost"
    ? "http://localhost:3010/api/graphql"
    : "";
if (CMS_API_URL === "") {
  throw new Error("Could not determine CMS API URL");
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_GCLOUD_FUNCTIONS_URL
  ? process.env.NEXT_PUBLIC_GCLOUD_FUNCTIONS_URL
  : networkName === "mainnet"
  ? "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net" /* will change this to: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net" before shipping. */
  : networkName === "murmuration"
  ? "https://murmuration.goldfinch.finance/_gcloudfunctions"
  : "http://localhost:5001/goldfinch-frontends-dev/us-central1";

type PersonaConfig = {
  templateId: string;
  environment: "sandbox" | "production";
};

export const PERSONA_CONFIG: PersonaConfig =
  process.env.NEXT_PUBLIC_PERSONA_TEMPLATE &&
  process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT
    ? ({
        templateId: process.env.NEXT_PUBLIC_PERSONA_TEMPLATE,
        environment: process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT,
      } as PersonaConfig)
    : networkName === "mainnet"
    ? {
        templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H",
        environment: "production",
      }
    : {
        templateId: "tmpl_vD1HECndpPFNeYHaaPQWjd6H",
        environment: "sandbox",
      };

export const SERVER_URL =
  typeof process.env.NEXT_PUBLIC_DEVTOOLS_SERVER_URL !== "undefined"
    ? process.env.NEXT_PUBLIC_DEVTOOLS_SERVER_URL
    : networkName === "mainnet"
    ? ""
    : networkName === "murmuration"
    ? "https://murmuration.goldfinch.finance"
    : "http://localhost:4000";

export const UNIQUE_IDENTITY_SIGNER_URL =
  networkName === "mainnet"
    ? "https://api.defender.openzeppelin.com/autotasks/bc31d6f7-0ab4-4170-9ba0-4978a6ed6034/runs/webhook/6a51e904-1439-4c68-981b-5f22f1c0b560/3fwK6xbVKfeBHZjSdsYQWe"
    : `${SERVER_URL}/uniqueIdentitySigner`;

export const UNIQUE_IDENTITY_MINT_PRICE = "830000000000000";

export const TOKEN_LAUNCH_TIME = 1641920400; // Tuesday, January 11, 2022 09:00:00 AM GMT-08:00 (note that this number is in seconds, not ms)
