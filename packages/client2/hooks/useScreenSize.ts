import { useState, useEffect } from "react";

import tailwindConfig from "../tailwind.config";

const parseSize = (size: string): number => parseInt(size.replace("px", ""));

type ScreenSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type ScreenConfig = Record<ScreenSize, string>;

const useScreenSize = (): ScreenSize | undefined => {
  const [screenSize, setScreenSize] = useState<ScreenSize>();

  useEffect(() => {
    const calculateSize = (): void => {
      const windowWidth = window.innerWidth;
      const screens = tailwindConfig.theme?.screens as ScreenConfig | undefined;

      if (!screens) {
        console.warn("No screens defined in tailwind.config.js");
        return;
      }

      let newSize: ScreenSize = "xs";
      for (const screen in screens) {
        const breakpoint = screen as ScreenSize;
        if (windowWidth >= parseSize(screens[breakpoint])) {
          newSize = breakpoint;
        } else {
          break;
        }
      }

      setScreenSize(newSize);
    };

    calculateSize();
    window.addEventListener("resize", calculateSize);
    return () => window.removeEventListener("resize", calculateSize);
  }, []);

  return screenSize;
};

export default useScreenSize;
