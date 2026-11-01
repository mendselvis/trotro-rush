"use client";
import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local");
    client = createClient(url, key, { realtime: { params: { eventsPerSecond: 30 } } });
  }
  return client;
}

// Every message in a room goes over one broadcast event, "msg", with a type field "t".
export type Msg = { t: string; [k: string]: any };

export interface Room {
  send: (msg: Msg) => void;
  leave: () => void;
}

export function joinRoom(code: string, onMsg: (msg: Msg) => void, onReady?: () => void): Room {
  const sb = getClient();
  const channel: RealtimeChannel = sb.channel(`trotro-${code}`, { config: { broadcast: { self: false } } });
  let ready = false;
  const queue: Msg[] = [];

  channel.on("broadcast", { event: "msg" }, ({ payload }) => onMsg(payload as Msg));
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      ready = true;
      queue.splice(0).forEach((m) => channel.send({ type: "broadcast", event: "msg", payload: m }));
      onReady?.();
    }
  });

  return {
    send: (msg) => {
      if (!ready) queue.push(msg);
      else channel.send({ type: "broadcast", event: "msg", payload: msg });
    },
    leave: () => {
      sb.removeChannel(channel);
    },
  };
}
