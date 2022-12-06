import clsx from "clsx";
import dynamic from "next/dynamic";
import { CSSProperties, useState } from "react";

import { Button, Drawer } from "@/components/design-system";

import TwinkleSvg from "./twinkle.svg";

// Lazy-loads React Router. That package is around 16kb and only needs to be present when the dev tools drawer is open
const DevToolsRouter = dynamic(() => import("./router"));

export function DevTools() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  return (
    <>
      <Button
        size="lg"
        onClick={() => setIsDrawerOpen(true)}
        className="group fixed bottom-5 right-5 z-10 scale-100 shadow-xl !transition-all hover:scale-105"
      >
        Dev Tools
        <AnimatedTwinkle className="-left-1 -top-1" />
        <AnimatedTwinkle
          className="-right-2 bottom-0"
          style={{ animationDelay: "0.2s" }}
        />
      </Button>
      <Drawer
        size="lg"
        from="bottom"
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Dev Tools"
      >
        <div style={{ height: "35vh", overflow: "auto" }}>
          <DevToolsRouter />
        </div>
      </Drawer>
    </>
  );
}

function AnimatedTwinkle({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <TwinkleSvg
      className={clsx(
        "pointer-events-none absolute h-6 w-6 scale-0 text-mustard-450 group-hover:animate-twinkle",
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
}
