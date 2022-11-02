import payload from "payload";
import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

console.log("WARNING: SEEDING ONLY WORKS ON AN EMPTY DATABASE");

// Initialize Payload
payload.init({
  secret: process.env.PAYLOAD_SECRET,
  mongoURL: process.env.MONGODB_URI,
  mongoOptions: {
    dbName: "payload",
  },
  local: true,
});

/**
 * Import files
 */
const borrowersData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "borrowers.json"), "utf-8")
);

const dealsData = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      process.env.SEED_LOCALHOST_DEALS ? "localhost-deals.json" : "deals.json"
    ),
    "utf-8"
  )
);

/**
 * Seed borrowers
 */
const seedBorrowers = async () => {
  console.log(
    `Importing borrower data: (${Object.keys(borrowersData).length} total)`
  );

  await Promise.all(
    Object.keys(borrowersData).map(async (slug) => {
      try {
        const borrower = borrowersData[slug];

        console.log(`Importing: ${borrower.name}`);

        const bio: {
          [k: string]: unknown;
        }[] = [
          {
            children: [
              {
                text: borrower.bio,
              },
            ],
          },
          ...(borrower.highlights
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
                  children: borrower.highlights.map((item) => ({
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

        return await payload.create({
          collection: "borrowers",
          data: {
            ...borrower,
            bio,
          },
        });
      } catch (e) {
        console.error(`Failed on: ${slug}`);
        throw new Error(`Borrowers error: ${e.message}`);
      }
    })
  );

  console.log(`Done importing borrowers`);
};

/**
 * Seed deals
 */
const seedDeals = async () => {
  console.log(`Importing deal data: (${Object.keys(dealsData).length} total)`);

  // Keep track of deals per borrower
  let dealMapping: {
    [borrowerId: string]: string[];
  } = {};

  // Get all borrowers
  const allBorrowersRequest = await payload.find({
    collection: "borrowers",
    depth: 0,
    limit: 100,
  });

  const borrowers = allBorrowersRequest.docs;

  await Promise.all(
    Object.keys(dealsData).map(async (id) => {
      try {
        const deal = dealsData[id];

        console.log(`Importing: ${id}`);

        const borrower = borrowers.find(
          (b) => b.name === borrowersData[deal.borrower].name
        );

        if (borrower) {
          // Add to mapping
          if (dealMapping[borrower.id]) {
            dealMapping[borrower.id] = [...dealMapping[borrower.id], id];
          } else {
            dealMapping[borrower.id] = [id];
          }

          await payload.create({
            collection: "deals",
            depth: 0,
            data: {
              ...deal,
              id,
              _id: id,
              overview: [{ text: deal.description }],
              details: deal.highlights
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
                      children: deal.highlights.map((item) => ({
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
              defaultInterestRate: deal.lateFeeApr ?? null,
              borrower: borrower.id,
            },
          });
        } else {
          throw new Error(`Borrower not found: ${id}`);
        }
      } catch (e) {
        console.error(`Failed on: ${id}`);

        throw new Error(`Deal error: ${e.message}`);
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
  await seedBorrowers();
  await seedDeals();

  process.exit(0);
};

main();
