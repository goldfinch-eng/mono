import { withSentry } from "@sentry/nextjs";
import { NextApiRequest, NextApiResponse } from "next";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!req.query.path) {
    return res.status(400).json({ message: "Must include a `path` parameter" });
  }
  // Check for secret to confirm this is a valid request
  if (req.query.secret !== process.env.REVALIDATION_SECRET) {
    return res
      .status(401)
      .json({ message: "Invalid revalidation secret token" });
  }

  try {
    await res.revalidate(req.query.path as string);
    return res.json({ revalidated: true });
  } catch (err) {
    // Even if there's an error here, Next.js will continue to serve the last valid version of this page
    return res.status(500).send({ message: "Error revalidating" });
  }
};
export default withSentry(handler);
