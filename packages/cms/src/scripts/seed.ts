import payload from "payload";
import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config();

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
  fs.readFileSync(path.resolve(__dirname, "deals.json"), "utf-8")
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

        return await payload.create({
          collection: "borrowers",
          data: {
            ...borrower,
            highlights: borrower.highlights
              ? borrower.highlights.map((h) => ({ text: h }))
              : [],
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

  await Promise.all(
    Object.keys(dealsData).map(async (id) => {
      try {
        const deal = dealsData[id];

        console.log(`Importing: ${id}`);

        const borrower = await payload.find({
          collection: "borrowers",
          where: {
            name: {
              equals: borrowersData[deal.borrower].name,
            },
          },
          depth: 0,
        });

        if (borrower.docs.length > 0) {
          console.log(`Found borrower: ${borrower.docs[0].name}`);

          return await payload.create({
            collection: "deals",
            depth: 0,
            data: {
              ...deal,
              id,
              _id: id,
              highlights: deal.highlights
                ? deal.highlights.map((h) => ({ text: h }))
                : [],
              overview: deal.description,
              defaultInterestRate: deal.lateFeeApr ?? null,
              borrower: borrower.docs[0].id,
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

  console.log(`Done importing deals`);
};

const main = async () => {
  await seedBorrowers();
  await seedDeals();

  process.exit(0);
};

main();
