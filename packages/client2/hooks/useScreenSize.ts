import { useState, useEffect } from "react";

import tailwindConfig from "../tailwind.config";

const parseSize = (size: string): number => parseInt(size.replace("px", ""));

type ScreenSizeString = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type ScreenConfig = Record<ScreenSizeString, string>;

const useScreenSize = (): ScreenSizeString => {
  const [screenSize, setScreenSize] = useState<ScreenSizeString>("xs");

  useEffect(() => {
    const calculateSize = (): void => {
      const windowWidth = window.innerWidth;
      const screens = tailwindConfig.theme?.screens as ScreenConfig | undefined;

      if (!screens) {
        console.warn("No screens defined in tailwind.config.js");
        return;
      }

      let newSize: ScreenSizeString = "xs";
      for (const screen in screens) {
        const breakpoint = screen as ScreenSizeString;
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
