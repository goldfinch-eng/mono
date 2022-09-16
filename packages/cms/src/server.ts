import express from "express";
import payload from "payload";
import cors from "cors";
import dotenv from "dotenv";

import { whitelist } from "./payload.config";

dotenv.config();
const app = express();

// Fix Payload cors issue for GraphQL
app.use(cors({ origin: whitelist, credentials: true }));

// Redirect root to Admin panel
app.get("/", (_, res) => {
  res.redirect("/admin");
});

payload.init({
  secret: process.env.PAYLOAD_SECRET,
  mongoURL: process.env.MONGODB_URI,
  express: app,
  onInit: () => {
    payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`);
    payload.logger.info(`Payload API URL: ${payload.getAPIURL()}`);
  },
});

app.listen(process.env.NODE_ENV === "production" ? 80 : 3010);
