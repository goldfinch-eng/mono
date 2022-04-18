import "../styles/globals.css";
import "react-toastify/dist/ReactToastify.min.css";
import { ApolloProvider } from "@apollo/client";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";

import { Nav } from "@/components/nav";
import { apolloClient } from "@/lib/graphql/apollo";
import { refreshGfiPrice } from "@/lib/graphql/local-state/actions";

export default function MyApp({ Component, pageProps }: AppProps) {
  useAppInitialization();
  return (
    <ApolloProvider client={apolloClient}>
      <ToastContainer position="top-center" />
      <Head>
        <title>Goldfinch</title>
        {/* remove this if we decide we want Google to index the app pages (unlikely) */}
        <meta name="robots" content="noindex" />
      </Head>

      <Nav />

      <div className="px-5">
        <div className="mx-auto min-h-full max-w-7xl py-14">
          <Component {...pageProps} />
        </div>
      </div>
    </ApolloProvider>
  );
}

/**
 * Side effects that should run on the client as the app initializes
 */
function useAppInitialization() {
  useEffect(() => {
    refreshGfiPrice();
  }, []);
}
