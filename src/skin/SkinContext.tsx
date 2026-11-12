import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import type { SkinChoice } from "../settings/types";
import { applySkinTokens, resolveSkin, skins, type Skin } from "./skins";

const SkinContext = createContext<Skin>(skins.native);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return dark;
}

/** Applies the chosen skin's tokens to `:root` and exposes copy + layout. */
export function SkinProvider({ choice, children }: { choice: SkinChoice; children: ReactNode }) {
  const systemDark = useSystemDark();
  const skin = skins[resolveSkin(choice, systemDark)];

  useLayoutEffect(() => {
    applySkinTokens(skin, document.documentElement);
  }, [skin]);

  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}

export function useSkin(): Skin {
  return useContext(SkinContext);
}
