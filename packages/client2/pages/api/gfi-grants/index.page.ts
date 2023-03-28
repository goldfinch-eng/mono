import fs from "fs";
import path from "path";

import { withSentry } from "@sentry/nextjs";
import { GraphQLClient, gql } from "graphql-request";
import { NextApiRequest, NextApiResponse } from "next";

import { SUBGRAPH_API_URL } from "@/constants";
import { GrantManifest, GrantWithSource } from "@/lib/gfi-rewards";
import {
  IndirectGrantSource,
  DirectGrantSource,
  KnownTokensQueryVariables,
  KnownTokensQuery,
} from "@/lib/graphql/generated";

type ExpectedQuery = {
  account: string;
};

const fileToSource: Record<string, IndirectGrantSource | DirectGrantSource> = {
  "./merkleDistributorInfo.json": "MERKLE_DISTRIBUTOR",
  "./merkleDistributorInfo.dev.json": "MERKLE_DISTRIBUTOR",
  "./backerMerkleDistributorInfo.json": "BACKER_MERKLE_DISTRIBUTOR",
  "./backerMerkleDistributorInfo.dev.json": "BACKER_MERKLE_DISTRIBUTOR",
  "./merkleDirectDistributorInfo.json": "MERKLE_DIRECT_DISTRIBUTOR",
  "./merkleDirectDistributorInfo.dev.json": "MERKLE_DIRECT_DISTRIBUTOR",
  "./backerMerkleDirectDistributorInfo.json":
    "BACKER_MERKLE_DIRECT_DISTRIBUTOR",
  "./backerMerkleDirectDistributorInfo.dev.json":
    "BACKER_MERKLE_DIRECT_DISTRIBUTOR",
};

const isHardhat = process.env.NEXT_PUBLIC_NETWORK_NAME === "localhost";

const sourceToFile: Record<IndirectGrantSource | DirectGrantSource, string> = {
  MERKLE_DISTRIBUTOR: isHardhat
    ? "./merkleDistributorInfo.dev.json"
    : "./merkleDistributorInfo.json",
  BACKER_MERKLE_DISTRIBUTOR: isHardhat
    ? "./backerMerkleDistributorInfo.dev.json"
    : "./backerMerkleDistributorInfo.json",
  MERKLE_DIRECT_DISTRIBUTOR: isHardhat
    ? "./merkleDirectDistributorInfo.dev.json"
    : "./merkleDirectDistributorInfo.json",
  BACKER_MERKLE_DIRECT_DISTRIBUTOR: isHardhat
    ? "./backerMerkleDirectDistributorInfo.dev.json"
    : "./backerMerkleDirectDistributorInfo.json",
};

const merkleDistributorFiles: (keyof typeof fileToSource)[] =
  process.env.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? ["./merkleDistributorInfo.json", "./backerMerkleDistributorInfo.json"]
    : [
        "./merkleDistributorInfo.dev.json",
        "./backerMerkleDistributorInfo.dev.json",
      ];

const merkleDirectDistributorFiles: (keyof typeof fileToSource)[] =
  process.env.NEXT_PUBLIC_NETWORK_NAME === "mainnet"
    ? [
        "./merkleDirectDistributorInfo.json",
        "./backerMerkleDirectDistributorInfo.json",
      ]
    : [
        "./merkleDirectDistributorInfo.dev.json",
        "./backerMerkleDirectDistributorInfo.dev.json",
      ];

function readGrantFile(file: string) {
  const pathname = path.resolve(`${process.cwd()}/gfi-grants`, file);
  const grantManifest: GrantManifest = JSON.parse(
    fs.readFileSync(pathname, "utf-8")
  );
  return grantManifest;
}

const filesToSearch = merkleDistributorFiles.concat(
  merkleDirectDistributorFiles
);

const fileData = filesToSearch.map((file) => {
  const grantManifest = readGrantFile(file);
  return { file, grantManifest };
});

function findMatchingGrantsByAccount(account: string): GrantWithSource[] {
  let allMatchingGrants: GrantWithSource[] = [];
  for (const { file, grantManifest } of fileData) {
    const matchingGrants = grantManifest.grants.filter(
      (grant) => grant.account.toLowerCase() === account.toLowerCase()
    );
    allMatchingGrants = allMatchingGrants.concat(
      matchingGrants.map((g) => ({
        source: fileToSource[file as keyof typeof fileToSource],
        ...g,
      }))
    );
  }

  return allMatchingGrants;
}

function findMatchingGrantsByIndexAndSource(
  index: number,
  source: DirectGrantSource | IndirectGrantSource
): GrantWithSource[] {
  // locate the json file
  const file = sourceToFile[source];
  const grantManifest = readGrantFile(file);

  const matchingGrants = grantManifest.grants.filter(
    (grant) => grant.index === index
  );

  return matchingGrants.map((g) => ({
    source,
    ...g,
  }));
}

const knownTokens = gql`
  query KnownTokens($account: String!) {
    communityRewardsTokens(where: { user: $account }) {
      user {
        id
      }
      index
      source
    }
  }
`;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const account = (req.query as ExpectedQuery).account;
  if (!account) {
    res.status(500).json({
      message: "You must provide an 'account' parameter in the query string.",
    });
    return;
  }
  try {
    const matchingGrantsFromJson = findMatchingGrantsByAccount(account); // Set A
    const gqlClient = new GraphQLClient(SUBGRAPH_API_URL);
    const knownTokensResult = await gqlClient.request<
      KnownTokensQuery,
      KnownTokensQueryVariables
    >(knownTokens, { account: account.toLowerCase() });
    const matchingGrantsFromOwnedTokens =
      knownTokensResult.communityRewardsTokens.flatMap((token) =>
        findMatchingGrantsByIndexAndSource(token.index, token.source)
      );

    res.status(200).json({
      account,
      matchingGrants: matchingGrantsFromJson.concat(
        matchingGrantsFromOwnedTokens
      ),
    });
  } catch (e) {
    res
      .status(500)
      .json({ message: `Error searching grants: ${(e as Error).message}` });
  }
};

export default withSentry(handler);
