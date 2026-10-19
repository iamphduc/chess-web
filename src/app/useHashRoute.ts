// Glue only: runs the route rules (route.ts) on mount and on every hashchange.
import { useEffect, useLayoutEffect, useState } from "react";

import { useAppDispatch } from "app/hooks";
import { followHash, type Screen } from "./route";

// Before paint in the browser, so a load of #/two-players never flashes home.
// Plain useEffect on the server, where useLayoutEffect warns.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The screen to show, kept in line with `location.hash`. */
export function useHashRoute(): Screen {
  const dispatch = useAppDispatch();
  const [screen, setScreen] = useState<Screen>("home");

  useBeforePaint(() => {
    const follow = () => setScreen(followHash(dispatch, window));
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [dispatch]);

  return screen;
}
