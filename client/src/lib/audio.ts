import type { Difficulty, LetterRelation } from "../../../shared/domain/types.js";

const VOICE_KEY = "rosco.voice.v1";
let audioContext: AudioContext | null = null;

export function spanishVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("es"));
}

export function loadVoiceName(): string {
  return localStorage.getItem(VOICE_KEY) ?? "";
}

export function saveVoiceName(name: string): void {
  if (name) localStorage.setItem(VOICE_KEY, name);
  else localStorage.removeItem(VOICE_KEY);
}

export function stopSpeaking(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function speakClue(
  clue: string,
  letter: string,
  relation: LetterRelation,
  difficulty: Difficulty,
  voiceName = loadVoiceName()
): boolean {
  const prefix = relation === "empieza" ? `Empieza con ${letter}.` : `Contiene la ${letter}.`;
  return speakText(`${prefix} ${clue}`, difficulty === "infantil" ? 0.82 : 0.92, voiceName);
}

export function speakText(text: string, rate = 0.92, voiceName = loadVoiceName()): boolean {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-AR";
  utterance.rate = rate;
  utterance.pitch = 1;
  const voices = spanishVoices();
  utterance.voice = voices.find((voice) => voice.name === voiceName)
    ?? voices.find((voice) => voice.lang.toLowerCase() === "es-ar")
    ?? voices[0]
    ?? null;
  window.speechSynthesis.speak(utterance);
  return true;
}

type FeedbackKind = "start" | "correct" | "incorrect" | "review" | "pass" | "pause" | "repeat";

const FEEDBACK_NOTES: Record<FeedbackKind, Array<[number, number, number]>> = {
  start: [[523, 0, 0.08], [659, 0.07, 0.1]],
  correct: [[523, 0, 0.09], [659, 0.08, 0.09], [784, 0.16, 0.14]],
  incorrect: [[220, 0, 0.16], [165, 0.12, 0.22]],
  review: [[440, 0, 0.08], [440, 0.12, 0.08]],
  pass: [[392, 0, 0.07], [330, 0.07, 0.1]],
  pause: [[294, 0, 0.12]],
  repeat: [[659, 0, 0.06]]
};

export function playFeedback(kind: FeedbackKind): void {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  const now = audioContext.currentTime;
  for (const [frequency, offset, duration] of FEEDBACK_NOTES[kind]) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + duration + 0.02);
  }
}
