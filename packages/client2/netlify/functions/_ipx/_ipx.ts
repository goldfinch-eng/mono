/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const handler: any = async (_event: any, _context: any) => {
  return {
    statusCode: 304,
    message: "Not Modified",
  };
};
