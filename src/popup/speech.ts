function pickEnglishVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang === "en-US") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
  );
}

/** Speak English text with the system voice. Prefers en-US, falls back to any en-*. */
export function speak(text: string): void {
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  const voice = pickEnglishVoice(synth.getVoices());
  if (voice) utterance.voice = voice;
  synth.cancel();
  synth.speak(utterance);
}
