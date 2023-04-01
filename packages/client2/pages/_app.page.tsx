import "react-toastify/dist/ReactToastify.min.css";
import "../styles/globals.css";
import { ApolloProvider } from "@apollo/client";
import type { AppProps } from "next/app";
import Head from "next/head";
import Script from "next/script";
import { ToastContainer } from "react-toastify";
import { WagmiConfig } from "wagmi";

import { DevTools } from "@/components/dev-tools";
import { Layout } from "@/components/layout";
import { AllNuxes } from "@/components/nuxes";
import { apolloClient } from "@/lib/graphql/apollo";
import { AppWideModals } from "@/lib/state/app-wide-modals";
import { WalletProvider } from "@/lib/wallet";
import { wagmiClient } from "@/lib/wallet/wagmi";

import { AppLevelSideEffects } from "./_app-side-effects";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      {process.env.NEXT_PUBLIC_GA_TRACKING_ID ? (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_TRACKING_ID}`}
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0], j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src= 'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f); })(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GA_TRACKING_ID}');
            `,
            }}
          />
        </>
      ) : null}

      {/* <WalletProvider> */}
      <WagmiConfig client={wagmiClient}>
        <ApolloProvider client={apolloClient}>
          <ToastContainer position="top-center" theme="colored" />
          <Head>
            <title>Goldfinch</title>
            {/* remove this if we decide we want Google to index the app pages (unlikely) */}
            <meta name="robots" content="noindex" />
          </Head>
          <Layout>
            <Component {...pageProps} />
          </Layout>

          {/* <AppWideModals /> */}

          {/* {process.env.NEXT_PUBLIC_NETWORK_NAME === "localhost" ||
          process.env.NEXT_PUBLIC_NETWORK_NAME === "murmuration" ? (
            <DevTools />
          ) : null} */}
          <AllNuxes />
          {/* <AppLevelSideEffects /> */}
        </ApolloProvider>
      </WagmiConfig>
      {/* </WalletProvider> */}
    </>
  );
}
