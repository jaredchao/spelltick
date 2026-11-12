import { splitByTerm } from "./highlight";

export interface ChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export const EXPLANATION_MAX_CHARS = 60;
const EXAMPLE_MAX_CHARS = 160;
const MEANING_MAX_CHARS = 40;

const SYSTEM = "你是简洁的英语老师，只输出要求的内容，不要解释，不要加引号或前缀。";

export function exampleMessages(term: string, meaning: string): readonly ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `给英文单词「${term}」（${meaning}）写一个职场或技术场景的英文例句。要求：一句话，不超过 20 个词，必须原样包含「${term}」这个词形。只输出例句。`,
    },
  ];
}

export function explanationMessages(term: string, given: string, meaning: string): readonly ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `学习者把「${term}」（${meaning}）拼成了「${given.trim()}」。用一两句中文讲清楚怎么记住正确拼写，可以讲词根、易混词或记忆方法，总共不超过 ${EXPLANATION_MAX_CHARS} 字。`,
    },
  ];
}

export function meaningMessages(term: string): readonly ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `给出「${term}」最常用的中文释义，一到两个义项，用「；」分隔，不超过 ${MEANING_MAX_CHARS} 字。只输出释义。`,
    },
  ];
}

function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l !== "") ?? ""
  );
}

function stripWrapping(text: string): string {
  return text
    .replace(/^(例句|释义|讲解|answer|example)\s*[:：]\s*/i, "")
    .replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, "")
    .trim();
}

/** A usable example sentence, or null if the reply does not contain the term. */
export function cleanExample(reply: string, term: string): string | null {
  const sentence = stripWrapping(firstLine(reply));
  if (sentence === "" || sentence.length > EXAMPLE_MAX_CHARS) return null;
  return splitByTerm(sentence, term).some((s) => s.match) ? sentence : null;
}

/** Explanation capped at 60 characters (SPEC 8). */
export function cleanExplanation(reply: string): string | null {
  const text = stripWrapping(reply.replace(/\s+/g, " ").trim());
  if (text === "") return null;
  const chars = Array.from(text);
  return chars.length <= EXPLANATION_MAX_CHARS ? text : `${chars.slice(0, EXPLANATION_MAX_CHARS - 1).join("")}…`;
}

export function cleanMeaning(reply: string): string | null {
  const text = stripWrapping(firstLine(reply));
  if (text === "") return null;
  return Array.from(text).slice(0, MEANING_MAX_CHARS).join("");
}

/** `https://api.x.com/v1/` -> `https://api.x.com/v1/chat/completions`. */
export function completionsUrl(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}/chat/completions`;
}
