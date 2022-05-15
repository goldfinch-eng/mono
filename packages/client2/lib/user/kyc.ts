import { gql } from "@apollo/client";

import { API_BASE_URL } from "@/constants";
import { apolloClient } from "@/lib/graphql/apollo";
import { getSignature, convertSignatureToAuth } from "@/lib/user";

export interface IKYCStatus {
  status: "unknown" | "approved" | "failed";
  countryCode: string;
}

const GET_KYC_STATUS = gql`
  query KYCStatusSetup {
    kycStatus @client {
      status
      countryCode
    }
  }
`;

/**
 * Get the current KYC status
 */
export async function getKYCStatus(account: string): Promise<IKYCStatus> {
  const url = `${API_BASE_URL}/kycStatus`;

  const kycFromCache = apolloClient.readQuery({ query: GET_KYC_STATUS });

  if (kycFromCache) {
    return kycFromCache;
  }

  try {
    const sigDetails = await getSignature();
    const auth = convertSignatureToAuth(account, sigDetails);

    if (auth) {
      const response = await fetch(url, {
        headers: auth,
      });

      const result: IKYCStatus = await response.json();

      apolloClient.writeQuery({
        query: GET_KYC_STATUS,
        data: {
          kycStatus: {
            status: result.status,
            countryCode: result.countryCode,
          },
        },
      });

      return result;
    } else {
      throw new Error("Could not get KYC status");
    }
  } catch {
    throw new Error("Could not get KYC status");
  }
}
