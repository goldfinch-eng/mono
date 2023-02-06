/* eslint-disable no-console */
import fs from "fs";
import path from "path";

import { GraphQLClient, gql } from "graphql-request";

const log = (s: string) =>
  console.log("\x1b[35m[cache-cms-data.ts] %s\x1b[0m", s);

async function main() {
  log("Fetching deal and borrower data from CMS...");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nextEnv = require("@next/env");
  const env = nextEnv.loadEnvConfig(".");

  const cmsApiUrl =
    typeof env.combinedEnv.NEXT_PUBLIC_CMS_GRAPHQL_API_URL !== "undefined"
      ? env.combinedEnv.NEXT_PUBLIC_CMS_GRAPHQL_API_URL
      : env.combinedEnv.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
      ? "http://cms.goldfinch.finance/api/graphql"
      : env.combinedEnv.NEXT_PUBLIC_NETWORK_NAME === "localhost"
      ? "http://localhost:3010/api/graphql"
      : null;
  log(`CMS URL is ${cmsApiUrl}`);
  const gqlClient = new GraphQLClient(cmsApiUrl);

  log("Fetching borrowers from CMS");
  const borrowerQuery = gql`
    {
      Borrowers(limit: 100) {
        docs {
          id
          name
          logo {
            url
          }
        }
      }
    }
  `;
  const borrowerQueryResult = await gqlClient.request(borrowerQuery);
  const borrowers = borrowerQueryResult.Borrowers.docs as {
    id: string;
    name: string;
    logo?: { url: string };
  }[];
  if (!borrowers) {
    throw new Error("No borrowers found in the CMS");
  }
  const borrowersJson: Record<string, { name: string; logo: string | null }> =
    {};
  borrowers.forEach((borrower) => {
    borrowersJson[borrower.id] = {
      name: borrower.name,
      logo: borrower.logo?.url ?? null,
    };
  });
  fs.writeFileSync(
    path.resolve("cms-cache", "borrowers.json"),
    JSON.stringify(borrowersJson, null, 2)
  );

  log("Fetching deals from CMS");
  const dealQuery = gql`
    {
      Deals(limit: 100) {
        docs {
          id
          name
          borrower {
            id
          }
        }
      }
    }
  `;
  const dealQueryResult = await gqlClient.request(dealQuery);
  const deals = dealQueryResult.Deals.docs as {
    id: string;
    name: string;
    borrower: { id: string };
  }[];
  if (!deals) {
    throw new Error("No deals found in the CMS");
  }
  const dealsJson: Record<string, { name: string; borrower: string }> = {};
  deals.forEach((deal) => {
    dealsJson[deal.id] = {
      name: deal.name,
      borrower: deal.borrower.id,
    };
  });
  fs.writeFileSync(
    path.resolve("cms-cache", "deals.json"),
    JSON.stringify(dealsJson, null, 2)
  );

  log("Finished");
  process.exit(0);
}

main();
