import dynamic from "next/dynamic";
import { useState } from "react";

import { Button, Drawer } from "@/components/design-system";

// Lazy-loads React Router. That package is around 16kb and only needs to be present when the dev tools drawer is open
const DevToolsRouter = dynamic(() => import("./router"));

export function DevTools() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  return (
    <>
      <Button
        size="lg"
        colorScheme="tidepool"
        className="fixed bottom-5 right-5"
        onClick={() => setIsDrawerOpen(true)}
      >
        Dev Tools 2
      </Button>
      <Drawer
        size="lg"
        from="bottom"
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      >
        <DevToolsRouter />
      </Drawer>
    </>
  );
}
