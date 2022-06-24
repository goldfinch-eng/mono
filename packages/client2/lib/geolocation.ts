import { Geolocation } from "./graphql/generated";

export async function fetchViewerGeolocation(): Promise<Geolocation> {
  if (process.env.NODE_ENV !== "production") {
    return Promise.resolve({ country: "US" });
  } else {
    const response = await fetch("/api/geolocation");
    if (!response.ok) {
      throw new Error("Could not get country");
    }
    return (await response.json()) as Geolocation;
  }
}
