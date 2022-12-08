import { SERVER_URL } from "@/constants";

export async function devserverRequest(endpoint: string, args: unknown) {
  return fetch(`${SERVER_URL}/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}

export async function advanceTimeNDays(n: number) {
  return devserverRequest("advanceTimeNDays", { n });
}
