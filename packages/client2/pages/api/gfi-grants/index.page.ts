import fs from "fs";
import path from "path";

import { withSentry } from "@sentry/nextjs";
import { NextApiRequest, NextApiResponse } from "next";

import { GrantManifest, GrantWithSource } from "@/lib/gfi-rewards";
import { GrantSource } from "@/lib/graphql/generated";

type ExpectedQuery = {
  account: string;
};

const fileToSource: Record<string, GrantSource> = {
  "./merkleDistributorInfo.json": GrantSource.MerkleDistributor,
  "./merkleDistributorInfo.dev.json": GrantSource.MerkleDistributor,
  "./backerMerkleDistributorInfo.json": GrantSource.BackerMerkleDistributor,
  "./backerMerkleDistributorInfo.dev.json": GrantSource.BackerMerkleDistributor,
  "./merkleDirectDistributorInfo.json": GrantSource.MerkleDirectDistributor,
  "./merkleDirectDistributorInfo.dev.json": GrantSource.MerkleDirectDistributor,
  "./backerMerkleDirectDistributorInfo.json":
    GrantSource.BackerMerkleDirectDistributor,
  "./backerMerkleDirectDistributorInfo.dev.json":
    GrantSource.BackerMerkleDirectDistributor,
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

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const account = (req.query as ExpectedQuery).account;
  if (!account) {
    res.status(500).json({
      message: "You must provide an 'account' parameter in the query string.",
    });
    return;
  }
  try {
    const filesToSearch = merkleDistributorFiles.concat(
      merkleDirectDistributorFiles
    );
    const matchingGrants = (
      await Promise.all(
        filesToSearch.map((file) => findMatchingGrants(account, file))
      )
    ).flat();

    res.status(200).json({ account, matchingGrants });
  } catch (e) {
    res
      .status(500)
      .json({ message: `Error searching grants: ${(e as Error).message}` });
  }
};

async function findMatchingGrants(
  account: string,
  file: string
): Promise<GrantWithSource[]> {
  const pathname = path.resolve(`${process.cwd()}/pages/api/gfi-grants`, file);
  const grantManifest: GrantManifest = JSON.parse(
    await fs.promises.readFile(pathname, "utf8")
  );
  const matchingGrants = grantManifest.grants.filter(
    (grant) => grant.account.toLowerCase() === account.toLowerCase()
  );
  return matchingGrants.map((g) => ({
    source: fileToSource[file as keyof typeof fileToSource],
    ...g,
  }));
}

export default withSentry(handler);
