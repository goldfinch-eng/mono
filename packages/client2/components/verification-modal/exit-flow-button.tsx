import { useRouter } from "next/router";
import { ReactNode } from "react";

import { Button } from "@/components/design-system";
import { closeVerificationModal } from "@/lib/state/actions";
import { isVerificationModalOpenVar } from "@/lib/state/vars";

export function ExitFlowButton({ children }: { children: ReactNode }) {
  const router = useRouter();
  const exitFlow = () => {
    const isModalActuallyOpen = isVerificationModalOpenVar();
    if (isModalActuallyOpen) {
      closeVerificationModal();
    } else {
      router.push("/earn");
    }
  };
  return (
    <Button size="lg" className="w-full" onClick={exitFlow}>
      {children}
    </Button>
  );
}
