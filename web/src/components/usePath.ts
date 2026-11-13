import { useEffect, useState } from "react";

/** The method page lives at #method, so the page works from any folder, a hosted copy included. */
export const METHOD_HASH = "#method";

let openedFromPage = false;

export function useMethodRoute(): { onMethod: boolean; open: () => void; back: () => void } {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return {
    onMethod: hash === METHOD_HASH,
    open() {
      openedFromPage = true;
      window.location.hash = METHOD_HASH;
    },
    back() {
      if (openedFromPage) {
        openedFromPage = false;
        window.history.back();
        return;
      }
      window.location.hash = "";
    },
  };
}
