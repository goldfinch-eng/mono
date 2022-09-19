import express from "express";
import payload from "payload";

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config();

const app = express();

// Redirect root to Admin panel
app.get("/", (_, res) => {
  res.redirect("/admin");
});

// Initialize Payload
payload.init({
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

// Listen
app.listen(process.env.PORT || 3010);
