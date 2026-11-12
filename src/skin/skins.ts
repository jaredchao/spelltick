import skinsJson from "../../docs/design/skins.json";
import type { SkinChoice } from "../settings/types";

export type SkinId = "native" | "terminal" | "paper";

export const SKIN_IDS: readonly SkinId[] = ["native", "terminal", "paper"];

export interface SkinCopy {
  readonly peek: string;
  readonly submit: string;
  readonly hint: string;
  readonly skip: string;
  readonly wrongTitle: string;
  readonly rightTitle: string;
  readonly nextReview: string;
  readonly continue: string;
  readonly trayNext: string;
  readonly trayToday: string;
  readonly aiLabel: string;
}

export interface SkinLayout {
  readonly titleBar: boolean;
  readonly feedbackStyle: "highlight" | "diff" | "card";
  readonly contentAlign: "start" | "center";
  readonly shortcutHintsInButtons: boolean;
  readonly peekMarker: "dot" | "chevron" | "tile";
}

export interface Skin {
  readonly id: SkinId;
  readonly name: string;
  readonly scheme: "light" | "dark";
  readonly tokens: Readonly<Record<string, string>>;
  readonly copy: SkinCopy;
  readonly layout: SkinLayout;
}

type SkinFile = Readonly<Record<SkinId, Omit<Skin, "id">>>;

const raw = skinsJson as unknown as SkinFile;

export const skins: Readonly<Record<SkinId, Skin>> = {
  native: { id: "native", ...raw.native },
  terminal: { id: "terminal", ...raw.terminal },
  paper: { id: "paper", ...raw.paper },
};

/** SPEC 9: "system" uses native when the OS is light and terminal when dark. */
export function resolveSkin(choice: SkinChoice, systemDark: boolean): SkinId {
  if (choice === "system") return systemDark ? "terminal" : "native";
  return choice;
}

/** Inject a skin's design tokens as CSS variables on `root`. */
export function applySkinTokens(skin: Skin, root: HTMLElement): void {
  Object.entries(skin.tokens).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
  root.style.colorScheme = skin.scheme;
  root.dataset.skin = skin.id;
}
