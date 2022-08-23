import { builder, Handler } from "@netlify/functions";

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
const unbuiltHandler: Handler = (_event, _context) => {};

export const handler = builder(unbuiltHandler);
