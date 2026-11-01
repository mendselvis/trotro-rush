# Trotro Rush

A party game for 2 to 6 friends. The laptop is the trotro, the phones are the controllers.

- **Driver**: steer between 3 lanes, hold brake, honk. Avoid potholes, cars and the police checkpoint (go slow or pay GH₵10).
- **Mate**: sees the next stops, taps a stop to shout it, and gives correct change for each fare.
- **Passengers**: get a destination and a secret mission. Press "Mate, bus stop!" before your stop.

To pick up or drop people, the driver must be in the right lane and fully stopped inside the painted BUS STOP bay.

## Run it

1. Create a free Supabase project. No tables needed, the game only uses Realtime broadcast.
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key (Settings > API).
3. Optional: add `ANTHROPIC_API_KEY` for AI missions and the AI trip report. Without it, built-in ones are used.
4. `npm install` then `npm run dev`.
5. Open `/host` on the laptop. Phones scan the QR code or open `/join/CODE`.

Testing with phones on the same Wi-Fi: run `npm run dev:lan` and open `http://YOUR-LAPTOP-IP:3000` on the phones. Or deploy to Vercel (add the same env vars there).

Solo testing: on the host screen, arrow keys steer, space brakes, H honks.

## How it works

- `lib/game.ts`: the whole game (movement, stops, fares, scoring). Only the host runs it.
- `lib/draw.ts`: draws the road, trotro, stops and obstacles on a canvas.
- `lib/room.ts`: one Supabase broadcast channel per room code.
- Phones send `hello` (join) and `input` messages. The host sends `lobby`, `start`, `state` (5 times a second) and `end`.
- `app/api/missions` and `app/api/report`: Claude calls, with fallbacks.

## Ideas if you have time

More routes, a day/night toggle, sound effects for the mate shouting, remote play with the road view on every phone, a hall leaderboard.
