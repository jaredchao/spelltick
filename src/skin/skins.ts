import skinsJson from "../../docs/design/skins.json";

export type SkinId = "native" | "terminal" | "paper";

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
}

export interface SkinLayout {
  readonly titleBar: boolean;
  readonly feedbackStyle: "highlight" | "diff" | "card";
  readonly inputStyle: "box" | "prompt" | "underline";
  readonly contentAlign: "start" | "center";
  readonly shortcutHintsInButtons: boolean;
}

export interface Skin {
  readonly name: string;
  readonly scheme: "light" | "dark";
  readonly tokens: Readonly<Record<string, string>>;
  readonly copy: SkinCopy;
  readonly layout: SkinLayout;
}

export const skins = skinsJson as Readonly<Record<SkinId, Skin>>;

/** Inject a skin's design tokens as CSS variables on `root`. */
export function applySkinTokens(skin: Skin, root: HTMLElement): void {
  Object.entries(skin.tokens).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
  root.style.colorScheme = skin.scheme;
}
