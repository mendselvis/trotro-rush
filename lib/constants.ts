export const ROUTE = ["Circle", "Adabraka", "Kaneshie", "Odorkor", "Lapaz", "Achimota", "Dome", "Madina"];
export const FARE = 4; // GH₵ per passenger
export const ROUND_SECONDS = 180;
export const CRUISE = 14; // metres per second
export const CAPACITY = 18;

export const FALLBACK_MISSIONS = [
  "Convince the mate your fare is only GH₵2.",
  "Complain loudly about the music every time the trotro brakes.",
  "Pretend you are on a very important phone call the whole trip.",
  "Ask the driver if he is sure this is the way to Madina.",
  "Tell everyone about your cousin who lives abroad.",
  "Act like you are asleep, then wake up shouting 'Where are we?'",
  "Start a debate about the best waakye joint in Accra.",
  "Keep asking the mate for your change, even after he gives it.",
  "Sell imaginary chewing gum to the other passengers.",
  "Insist the window must stay open, no matter what.",
];

export type Role = "driver" | "mate" | "passenger";

export interface Player {
  id: string;
  name: string;
  role: Role;
}

export function roomCode(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 4; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}
