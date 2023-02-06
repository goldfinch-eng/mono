import express from "express";
import payload from "payload";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
require("dotenv").config();

const app = express();

const start = async () => {
  // Initialize Payload
  await payload.init({
    secret: process.env.PAYLOAD_SECRET,
    mongoURL: process.env.MONGODB_URI,
    mongoOptions: {
      dbName: "payload",
    },
    express: app,
    onInit: () => {
      payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`);
    },
  });

  // Redirect root to Admin panel
  app.get("/", (_, res) => {
    res.redirect("/admin");
  });

  // Listen
  app.listen(parseInt(process.env.PORT) || 3010);
};

start();
