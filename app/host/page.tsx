"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { joinRoom, Room, Msg } from "@/lib/room";
import { Game, Bubble } from "@/lib/game";
import { drawGame } from "@/lib/draw";
import { play, unlockAudio } from "@/lib/sound";
import { Player, Role, roomCode } from "@/lib/constants";

type Phase = "lobby" | "playing" | "ended";

export default function Host() {
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [hud, setHud] = useState<any>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [report, setReport] = useState<{ text: string; score: number; stats: any } | null>(null);
  const [error, setError] = useState("");

  const roomRef = useRef<Room | null>(null);
  const gameRef = useRef<Game | null>(null);
  const playersRef = useRef<Player[]>([]);
  const phaseRef = useRef<Phase>("lobby");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setCode(roomCode());
    setOrigin(window.location.origin);
  }, []);

  const setPlayersBoth = (p: Player[]) => {
    playersRef.current = p;
    setPlayers(p);
  };
  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const sendLobby = useCallback(() => {
    roomRef.current?.send({ t: "lobby", players: playersRef.current, phase: phaseRef.current });
  }, []);

  const onMsg = useCallback((m: Msg) => {
    if (m.t === "hello") {
      const list = [...playersRef.current];
      let role: Role = m.role;
      const taken = list.find((p) => p.role === role && p.id !== m.id && role !== "passenger");
      if (taken) role = "passenger";
      const name = String(m.name || "Guest").slice(0, 14);
      const i = list.findIndex((p) => p.id === m.id);
      // roles are locked once the trip starts
      if (i >= 0 && phaseRef.current === "playing") role = list[i].role;
      const player = { id: m.id, name, role };
      if (i >= 0) list[i] = player;
      else list.push(player);
      setPlayersBoth(list);
      if (phaseRef.current === "playing" && role === "passenger") gameRef.current?.addPax(m.id, name, "Make up your own mission. Be dramatic.");
      sendLobby();
    }
    if (m.t === "input") {
      const p = playersRef.current.find((p) => p.id === m.id);
      if (p && gameRef.current) gameRef.current.input(p.id, p.role, m.a, m.data);
    }
  }, [sendLobby]);

  useEffect(() => {
    if (!code) return;
    try {
      const room = joinRoom(code, onMsg, sendLobby);
      roomRef.current = room;
      return () => room.leave();
    } catch (e: any) {
      setError(e.message);
    }
  }, [code, onMsg, sendLobby]);

  const endTrip = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return;
    setPhaseBoth("ended");
    const names = playersRef.current.map((p) => `${p.name} (${p.role})`);
    let text = "";
    try {
      const r = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stats: g.stats, score: g.score, names }),
      });
      text = (await r.json()).report;
    } catch {
      text = "The station master is speechless.";
    }
    setReport({ text, score: g.score, stats: g.stats });
    roomRef.current?.send({ t: "end", score: g.score, report: text });
    sendLobby();
  }, [sendLobby]);

  const startTrip = async () => {
    unlockAudio();
    const pax = playersRef.current.filter((p) => p.role === "passenger");
    let missions: string[] = [];
    try {
      const r = await fetch("/api/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: Math.max(1, pax.length) }),
      });
      missions = (await r.json()).missions ?? [];
    } catch {}
    const g = new Game(pax, missions);
    g.onSound = play;
    gameRef.current = g;
    setReport(null);
    setPhaseBoth("playing");
    roomRef.current?.send({ t: "start" });
    sendLobby();
  };

  // game loop
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let lastSend = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (now: number) => {
      const g = gameRef.current!;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.step(dt);
      drawGame(ctx, g, canvas.clientWidth, canvas.clientHeight);
      if (now - lastSend > 200) {
        lastSend = now;
        const snap = g.snapshot();
        roomRef.current?.send(snap);
        setHud(snap);
        setBubbles([...g.bubbles]);
      }
      if (g.over) {
        endTrip();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [phase, endTrip]);

  // test controls on the laptop keyboard, handy when you are building alone
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g || phaseRef.current !== "playing" || e.repeat) return;
      if (e.key === "ArrowLeft") g.input("kb", "driver", "left");
      if (e.key === "ArrowRight") g.input("kb", "driver", "right");
      if (e.key === " ") g.input("kb", "driver", "brake_on");
      if (e.key === "h") g.input("kb", "driver", "horn");
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") gameRef.current?.input("kb", "driver", "brake_off");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const joinUrl = code && origin ? `${origin}/join/${code}` : "";
  const driver = players.find((p) => p.role === "driver");
  const mate = players.find((p) => p.role === "mate");
  const passengers = players.filter((p) => p.role === "passenger");

  if (error) {
    return (
      <main className="home">
        <div className="panel" style={{ maxWidth: 520 }}>
          <p className="big">Setup needed</p>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (phase === "lobby") {
    return (
      <main className="lobby">
        <div className="code-card">
          <div style={{ fontWeight: 900 }}>Scan or go to {origin.replace(/^https?:\/\//, "")}/join</div>
          <div className="code display">{code || "...."}</div>
          {joinUrl && (
            <div className="qr">
              <QRCodeSVG value={joinUrl} size={200} fgColor="#16213E" />
            </div>
          )}
        </div>

        <section className="crew">
          <h2 className="display">Who dey inside?</h2>
          <div className={`seat ${driver ? "" : "empty"}`}>
            <span className="tag driver">Driver</span>
            {driver ? driver.name : "Waiting for a driver"}
          </div>
          <div className={`seat ${mate ? "" : "empty"}`}>
            <span className="tag mate">Mate</span>
            {mate ? mate.name : "Waiting for a mate"}
          </div>
          {passengers.map((p) => (
            <div className="seat" key={p.id}>
              <span className="tag passenger">Passenger</span>
              {p.name}
            </div>
          ))}
          {passengers.length === 0 && (
            <div className="seat empty"><span className="tag passenger">Passenger</span>Passengers are optional, but louder</div>
          )}
          <div style={{ marginTop: 12 }}>
            <button className="btn green" disabled={!driver} onClick={startTrip}>
              {driver ? "Start the trip" : "Need a driver to start"}
            </button>
            {driver && !mate && <p className="muted">No mate yet. Fares will go uncollected.</p>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="host">
      <canvas ref={canvasRef} aria-label="Trotro game view" />
      <div className="hud">
        <div className="hud-top">
          <div className="plate"><small>Score</small>{hud?.score ?? 0}</div>
          <div className="plate"><small>Room {code}</small>{fmt(hud?.timeLeft ?? 0)}</div>
          <div className="plate"><small>Speed</small>{hud?.speed ?? 0} km/h</div>
        </div>
        <div className="bubbles">
          {bubbles.map((b) => (
            <div key={b.id} className={`bubble ${b.kind}`}><b>{b.who}</b>{b.text}</div>
          ))}
        </div>
        {hud?.stops?.[0] && (
          <div className="nextstop plate">
            <small>Next stop</small>
            {hud.stops[0].name} in {hud.stops[0].distance} m
          </div>
        )}
      </div>

      {phase === "ended" && (
        <div className="overlay">
          <div className="report">
            <h2 className="display">Trip report</h2>
            <div className="score">{report ? report.score : "..."}</div>
            <p>{report ? report.text : "The station master is counting your money..."}</p>
            {report && (
              <div className="statgrid">
                <div><span>GH₵{report.stats.cedis}</span>Fares collected</div>
                <div><span>{report.stats.servedStops}</span>Stops served</div>
                <div><span>{report.stats.happyDrops}</span>Happy drop-offs</div>
                <div><span>{report.stats.missedStops}</span>Missed stops</div>
                <div><span>{report.stats.crashes + report.stats.potholes}</span>Crashes and potholes</div>
                <div><span>{report.stats.wrongChange}</span>Wrong change</div>
              </div>
            )}
            <button className="btn" onClick={() => { setPhaseBoth("lobby"); sendLobby(); }}>Back to the station</button>
          </div>
        </div>
      )}
    </main>
  );
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
