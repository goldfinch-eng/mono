/**
 *  function to generate a URL based on a base string and query params
 */
export function buildURL(
  baseURL: string,
  queryParams: { [key: string]: string }
) {
  const url = new URL(baseURL);
  for (const paramKey in queryParams) {
    url.searchParams.append(paramKey, queryParams[paramKey]);
  }
  return url;
}
