import payload from "payload";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

export const initializePayload = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET as string,
    mongoURL: process.env.MONGODB_URI as string,
    mongoOptions: {
      dbName: "payload",
    },
    local: true,
  });
};
