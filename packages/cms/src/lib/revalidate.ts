/**
 * Tells the app to regenerate the page at `path`.
 */
export async function revalidate(path: string) {
  try {
    const response = await fetch(
      `${process.env.APP_ORIGIN}/api/revalidate?secret=${process.env.REVALIDATION_SECRET}&path=${path}`,
      { method: "POST" }
    );
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message);
    }
  } catch (e) {
    if (!process.env.SEEDING_DB) {
      console.error(`Revalidation failed. ${(e as Error).message}`);
    }
  }
}
