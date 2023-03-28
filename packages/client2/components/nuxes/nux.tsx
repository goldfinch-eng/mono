import { useRouter } from "next/router";
import {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import { GoldfinchLogo, Modal } from "@/components/design-system";

export interface NuxRef {
  closeNux: () => void;
}

interface NuxProps {
  prefix: string;
  version?: number;
  children: ReactNode;
  title?: string;
  shouldShowOnPage?: (pathname: string) => boolean;
}

export const Nux = forwardRef<NuxRef, NuxProps>(function Nux(
  {
    prefix,
    version = 1,
    children,
    title = "From the Goldfinch Team",
    shouldShowOnPage = () => true,
  }: NuxProps,
  ref
) {
  const [isNuxOpen, setIsNuxOpen] = useState(false);
  const nuxKey = `${prefix}-${version}`;
  const closeNux = () => {
    setIsNuxOpen(false);
    localStorage.setItem(nuxKey, "viewed");
  };

  const { pathname } = useRouter();
  useEffect(() => {
    if (
      localStorage.getItem(nuxKey) !== "viewed" &&
      shouldShowOnPage(pathname)
    ) {
      setIsNuxOpen(true);
    }
  }, [nuxKey, pathname, shouldShowOnPage]);

  useImperativeHandle(ref, () => ({ closeNux }));

  return (
    <Modal
      isOpen={isNuxOpen}
      onClose={closeNux}
      title={
        <div className="flex items-center gap-4">
          <GoldfinchLogo className="h-4 w-4" />
          <div className="text-xs font-normal text-sand-500">{title}</div>
        </div>
      }
      size="xs"
    >
      {children}
    </Modal>
  );
});
