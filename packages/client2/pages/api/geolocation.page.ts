import { withSentry } from "@sentry/nextjs";
import type { NextApiRequest, NextApiResponse } from "next";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  let ip;

  if (req.headers["x-forwarded-for"]) {
    ip = (req.headers["x-forwarded-for"] as string).split(",")[0];
  } else {
    ip = req.socket.remoteAddress;
  }

  try {
    const ipInfoResponse = await fetch(
      `https://ipinfo.io/${ip}?token=679544298a8c59`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
    const jsonBody = await ipInfoResponse.json();
    if (!ipInfoResponse.ok) {
      const message = jsonBody.error.message;
      throw new Error(message);
    }
    const country = jsonBody.country;
    if (!country) {
      throw new Error("Unable to get country from IP address.");
    }

    res
      .status(200)
      .setHeader("Cache-Control", "no-store")
      .json({ country: jsonBody.country });
    return;
  } catch (e) {
    res.status(500).json({
      message: `Failed to get IP info. Error: ${(e as Error).message}`,
    });
  }
};

export default withSentry(handler);
