import NextErrorComponent from "next/error";

export default function Custom404() {
  return <NextErrorComponent statusCode={404} />;
}
