import { encode } from "html-entities";
import Head from "next/head";

interface SEOProps {
  title?: string | null;
}

export function SEO({ title }: SEOProps) {
  const seoTitle = title ? `${encode(title)} | Goldfinch` : "Goldfinch";

  return (
    <Head>
      <title>{seoTitle}</title>

      <meta property="og:title" content={seoTitle} />
      <meta name="twitter:title" content={seoTitle}></meta>
    </Head>
  );
}
