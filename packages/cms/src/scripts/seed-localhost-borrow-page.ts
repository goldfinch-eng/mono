import payload from "payload";
import path from "path";
import { GraphQLClient, gql } from "graphql-request";
import _ from "lodash";

import { Borrower, Deal, Media } from "payload/generated-types";
import { initializePayload } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
require("dotenv").config({
  path: path.resolve(__dirname, "../../../../.env.local"),
});

const borrowPageBorrower = {
  name: "Borrowers Inc",
  orgType: "Fintech",
  website: "https://goldfinch.finance",
  linkedin: "https://www.linkedin.com/company/goldfinchfinance/",
  twitter: "https://twitter.com/goldfinch_fi",
  bio: "We love to borrow",
  highlights: ["Borrowing is awesome"],
  logoPath: null,
};

/**
 * Setup Deals & Borrower for borrow page testing
 */
const setupBorrowPageContent = async () => {
  console.log(`Adding a borrower for borrow page.`);

  try {
    const existingBorrower = await payload.find({
      collection: "borrowers",
      where: { name: { equals: borrowPageBorrower.name } },
    });
    if (existingBorrower.docs.length === 0) {
      console.log(`Importing borrower: ${borrowPageBorrower.name}`);
      let logoId: string;
      if (borrowPageBorrower.logoPath) {
        const thing = await payload.create({
          collection: "media",
          data: { alt: "Pug" } as Media,
          filePath: borrowPageBorrower.logoPath,
        });
        logoId = thing.id;
      }

      const bio: {
        [k: string]: unknown;
      }[] = [
        {
          children: [
            {
              text: borrowPageBorrower.bio,
            },
          ],
        },
        ...(borrowPageBorrower.highlights
          ? [
              {
                children: [
                  {
                    text: "Highlights",
                  },
                ],
                type: "h3",
              },
              {
                children: borrowPageBorrower.highlights.map((item) => ({
                  children: [
                    {
                      text: item,
                    },
                  ],
                  type: "li",
                })),
                type: "ul",
              },
            ]
          : []),
      ];

      await payload.create({
        collection: "borrowers",
        data: {
          ...borrowPageBorrower,
          bio,
          logo: logoId,
        } as unknown as Borrower,
        filePath: borrowPageBorrower.logoPath,
      });
    } else {
      console.log(`Skipping borrower is already in the database`);
    }
  } catch (e) {
    console.error(`Failed on: ${borrowPageBorrower.name}`);
    throw new Error(`Borrowers error: ${e.message}`);
  }

  console.log(`Done creating borrower for borrow page.`);

  const gqlClient = new GraphQLClient(
    "http://localhost:8000/subgraphs/name/goldfinch-subgraph"
  );

  try {
    const sampleQuery = gql`
      {
        _meta {
          block {
            number
          }
        }
      }
    `;
    await gqlClient.request(sampleQuery);
  } catch (e) {
    console.error(
      "Failed to import deals because the subgraph could not be reached."
    );
    console.error(e.message);
    return;
  }

  // Keep track of deals per borrower
  const dealMapping: {
    [borrowerId: string]: string[];
  } = {};

  // Get all borrowers
  const allBorrowersRequest = await payload.find({
    collection: "borrowers",
    depth: 0,
    limit: 100,
  });

  const borrowers = allBorrowersRequest.docs;
  const borrowPageBorrowerAddressId = process.env.TEST_USER;
  const borrowerPageDealsQuery = gql`
    {
      loans(
        where: { borrowerContract_: { user: "${borrowPageBorrowerAddressId.toLocaleLowerCase()}" } }
        orderBy: createdAt
        orderDirection: desc
      ) {
        __typename
        id
        borrowerContract {
          id
        }
        termStartTime
      }
    }
  `;
  const borrowerPageDealsQueryResult = await gqlClient.request(
    borrowerPageDealsQuery
  );

  console.log(
    `Importing borrow page loans from subgraph as deals (${borrowerPageDealsQueryResult.loans.length} total)`
  );

  const borrowPageCmsBorrower = borrowers.find(
    ({ name }) => name === borrowPageBorrower.name
  );

  await Promise.all(
    borrowerPageDealsQueryResult.loans.map(async (loan, i) => {
      const id = loan.id;
      const borrowerId = borrowPageCmsBorrower.id;

      const deal = {
        name: `Borrower loan #${i + 1}`,
        category: `Sample borrower loan #${i + 1}`,
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc eget mi fringilla, maximus quam sodales, condimentum arcu. Vivamus arcu lorem, ultrices at ligula ut, tempor consectetur nibh. Vivamus commodo felis eu urna facilisis, feugiat gravida lectus egestas. Suspendisse consectetur urna at ornare lacinia. Etiam erat nunc, interdum sed gravida at, condimentum in metus. Mauris at sagittis libero.",
        dealHighlights: ["Uno", "Dos", "Tres"],
        borrower: borrowerId,
      };
      if (dealMapping[borrowerId]) {
        dealMapping[borrowerId] = [...dealMapping[borrowerId], id];
      } else {
        dealMapping[borrowerId] = [id];
      }

      try {
        await payload.create({
          collection: "deals",
          depth: 0,
          data: {
            ...deal,
            id,
            overview: [{ text: deal.description }],
            details: deal.dealHighlights
              ? [
                  {
                    children: [
                      {
                        text: "Highlights",
                      },
                    ],
                    type: "h3",
                  },
                  {
                    children: deal.dealHighlights.map((item) => ({
                      children: [
                        {
                          text: item,
                        },
                      ],
                      type: "li",
                    })),
                    type: "ul",
                  },
                ]
              : null,
            borrower: borrowerId,
            dealType: _.sample(["multitranche", "unitranche"]) as
              | "multitranche"
              | "unitranche",
          } as unknown as Deal,
        });
      } catch (e) {
        console.log(`Error: ${(e as Error).message}`);
        console.log(
          `Did not import borrower page loan ${id} due to the above error`
        );
      }
    })
  );

  // Set borrower relation
  await Promise.all(
    Object.keys(dealMapping).map(async (borrowerId) => {
      return await payload.update({
        id: borrowerId,
        collection: "borrowers",
        depth: 0,
        data: {
          deals: dealMapping[borrowerId],
        },
      });
    })
  );

  console.log(`Done importing deals`);
};

const main = async () => {
  await initializePayload();
  await setupBorrowPageContent();

  process.exit(0);
};

main();
