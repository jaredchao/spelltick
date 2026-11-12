import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";
import { applySkinTokens, skins, type Skin, type SkinId } from "./skins";

const SkinContext = createContext<Skin>(skins.native);

// M1 always uses the native skin. Switching and "follow system" arrive in M4.
export function SkinProvider({ id, children }: { id: SkinId; children: ReactNode }) {
  const skin = skins[id];

  useLayoutEffect(() => {
    applySkinTokens(skin, document.documentElement);
  }, [skin]);

  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}

export function useSkin(): Skin {
  return useContext(SkinContext);
}
