interface GeolocationData {
  ip: string;
  city: string;
  region: string;
  country: string;
  loc: string;
  org: string;
  postal: string;
  timezone: string;
}

export async function getGeolocation(): Promise<GeolocationData> {
  if (process.env.NEXT_PUBLIC_NETWORK_NAME === "localhost") {
    return Promise.resolve({
      ip: "123.456.789.0",
      city: "Oakland",
      region: "California",
      country: "US",
      loc: "37.8044,-122.2708",
      org: "AS701 MCI Communications Services, Inc. d/b/a Verizon Business",
      postal: "94604",
      timezone: "America/Los_Angeles",
    });
  } else {
    const response = await fetch("https://ipinfo.io?token=679544298a8c59", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      return (await response.json()) as GeolocationData;
    } else {
      return Promise.reject(response);
    }
  }
}
