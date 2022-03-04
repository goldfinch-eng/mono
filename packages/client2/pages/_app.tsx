import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";

import { Sidebar } from "@/components/sidebar";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Goldfinch</title>
        {/* remove this if we decide we want Google to index the app pages (unlikely) */}
        <meta name="robots" content="noindex" />
      </Head>
      <div className="flex h-full flex-col md:flex-row">
        <Sidebar />
        <div className="flex-grow px-10 py-8 md:pt-20">
          <Component {...pageProps} />
        </div>
      </div>
    </>
  );
}
