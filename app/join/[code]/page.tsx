"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { joinRoom, Room, Msg } from "@/lib/room";
import { Player, Role } from "@/lib/constants";

function getId() {
  try {
    let id = sessionStorage.getItem("trotro-id");
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("trotro-id", id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

const buzz = (ms = 20) => {
  try { navigator.vibrate?.(ms); } catch {}
};

export default function Join() {
  const params = useParams<{ code: string }>();
  const code = String(params.code || "").toUpperCase();

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [wanted, setWanted] = useState<Role | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState("lobby");
  const [state, setState] = useState<any>(null);
  const [end, setEnd] = useState<{ score: number; report: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    setId(getId());
    try { setName(sessionStorage.getItem("trotro-name") || ""); } catch {}
  }, []);

  const me = players.find((p) => p.id === id);
  const role = me?.role;

  useEffect(() => {
    if (!id) return;
    try {
      const room = joinRoom(code, (m: Msg) => {
        if (m.t === "lobby") {
          setPlayers(m.players);
          setPhase(m.phase);
          if (m.phase === "lobby") setEnd(null);
        }
        if (m.t === "start") { setEnd(null); setPhase("playing"); buzz(200); }
        if (m.t === "state") setState(m);
        if (m.t === "end") { setEnd({ score: m.score, report: m.report }); setPhase("ended"); buzz(300); }
      }, () => setConnected(true));
      roomRef.current = room;
      return () => room.leave();
    } catch (e: any) {
      setError(e.message);
    }
  }, [code, id]);

  // keep saying hello until the host lists us, so a late host or a dropped message still works
  useEffect(() => {
    if (!wanted || !connected) return;
    const hello = () => roomRef.current?.send({ t: "hello", id, name: name.trim() || "Guest", role: wanted });
    hello();
    if (me) return;
    const timer = setInterval(hello, 1500);
    return () => clearInterval(timer);
  }, [wanted, connected, me, id, name]);

  const send = (a: string, data: any = {}) => {
    buzz();
    roomRef.current?.send({ t: "input", id, a, data });
  };

  if (error) return <Shell title="Setup needed"><p>{error}</p></Shell>;

  // 1. pick name and role
  if (!wanted || !me) {
    const taken = (r: Role) => players.some((p) => p.role === r && p.id !== id);
    return (
      <main className="phone">
        <header>
          <span className="display">Trotro Rush</span>
          <span className="muted">Room {code}</span>
        </header>
        <input
          className="field"
          placeholder="Your name"
          maxLength={14}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            try { sessionStorage.setItem("trotro-name", e.target.value); } catch {}
          }}
        />
        <div className="roles">
          <button className="btn" disabled={!name.trim() || taken("driver")} onClick={() => setWanted("driver")}>
            Driver<small>{taken("driver") ? "Someone is already driving" : "Steer, brake, avoid potholes and police"}</small>
          </button>
          <button className="btn green" disabled={!name.trim() || taken("mate")} onClick={() => setWanted("mate")}>
            Mate<small>{taken("mate") ? "Already taken" : "Call the stops and give correct change"}</small>
          </button>
          <button className="btn red" disabled={!name.trim()} onClick={() => setWanted("passenger")}>
            Passenger<small>Get to your stop and play your secret mission</small>
          </button>
        </div>
        {wanted && !me && <p className="muted center">{connected ? "Finding the trotro..." : "Connecting..."}</p>}
      </main>
    );
  }

  // 2. waiting in the lobby
  if (phase === "lobby" || !state) {
    return (
      <Shell title={me.name} role={me.role}>
        <div className="panel grow" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div className="big">You are the {me.role}</div>
            <p className="muted">{lobbyHint(me.role)}</p>
            <p className="muted">Waiting for the host to start the trip.</p>
          </div>
        </div>
        <button className="btn ghost" onClick={() => setWanted(null)}>Change role</button>
      </Shell>
    );
  }

  // 3. trip over
  if (phase === "ended" && end) {
    return (
      <Shell title={me.name} role={me.role}>
        <div className="panel">
          <h3>Final score</h3>
          <div className="big">{end.score}</div>
        </div>
        <div className="panel grow"><p style={{ fontSize: 18, lineHeight: 1.5, margin: 0 }}>{end.report}</p></div>
        <p className="muted center">Look at the big screen for the full trip report.</p>
      </Shell>
    );
  }

  // 4. playing
  return (
    <Shell title={me.name} role={me.role} timeLeft={state.timeLeft}>
      {role === "driver" && <DriverPad state={state} send={send} />}
      {role === "mate" && <MatePad state={state} send={send} />}
      {role === "passenger" && <PassengerPad state={state} id={id} send={send} />}
    </Shell>
  );
}

function lobbyHint(role: Role) {
  if (role === "driver") return "You only see the road. Listen to your mate for the stops.";
  if (role === "mate") return "You see the stops and the fares. Shout loud.";
  return "You get a destination and a secret mission. Do not miss your stop.";
}

function Shell({ title, role, timeLeft, children }: { title: string; role?: Role; timeLeft?: number; children: React.ReactNode }) {
  return (
    <main className={`phone ${role ?? ""}`}>
      <header>
        <span className="display">{title}</span>
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {typeof timeLeft === "number" && <span className="display">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</span>}
          {role && <span className="rolepill">{role}</span>}
        </span>
      </header>
      {children}
    </main>
  );
}

function HoldButton({ onDown, onUp, className, children }: { onDown: () => void; onUp: () => void; className: string; children: React.ReactNode }) {
  const [down, setDown] = useState(false);
  return (
    <button
      className={`${className} ${down ? "down" : ""}`}
      onPointerDown={(e) => { e.preventDefault(); setDown(true); onDown(); }}
      onPointerUp={() => { setDown(false); onUp(); }}
      onPointerLeave={() => { if (down) { setDown(false); onUp(); } }}
      onPointerCancel={() => { setDown(false); onUp(); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

function DriverPad({ state, send }: { state: any; send: (a: string, d?: any) => void }) {
  return (
    <>
      <div className="panel">
        <h3>Speed</h3>
        <div className="big">{state.speed} km/h</div>
        <p className="muted" style={{ margin: "6px 0 0" }}>To stop for passengers: get into the right lane and hold brake until you stop.</p>
      </div>
      <div className="grow" />
      <div className="pad two">
        <button className="btn blue" onPointerDown={(e) => { e.preventDefault(); send("left"); }}>◀ Left</button>
        <button className="btn blue" onPointerDown={(e) => { e.preventDefault(); send("right"); }}>Right ▶</button>
      </div>
      <HoldButton className="btn red huge" onDown={() => send("brake_on")} onUp={() => send("brake_off")}>Hold to brake</HoldButton>
      <button className="btn" onPointerDown={(e) => { e.preventDefault(); send("horn"); }}>Horn</button>
    </>
  );
}

function MatePad({ state, send }: { state: any; send: (a: string, d?: any) => void }) {
  const fare = state.fares?.[0];
  const options = fare ? changeOptions(fare.paid - fare.fare) : [];
  return (
    <>
      <div className="panel">
        <h3>Upcoming stops: tap to shout one</h3>
        <div className="stoplist">
          {state.stops.slice(0, 3).map((s: any) => (
            <div className="stoprow" key={s.idx}>
              <button className={`btn ${s.called ? "" : "green"}`} disabled={s.served} onClick={() => send("call", { stop: s.idx })}>
                {s.name}{s.called ? " ✓" : ""}
              </button>
              <div className="info">
                {s.distance} m<br />
                {s.waiting} waiting · {s.alighting} getting down
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel fare grow">
        <h3>Fares {state.fares.length > 1 ? `(${state.fares.length} waiting)` : ""}</h3>
        {fare ? (
          <>
            <div className="pay">Paid GH₵{fare.paid} for a GH₵{fare.fare} fare. Give change:</div>
            <div className="chips">
              {options.map((c) => (
                <button key={c} className="btn" onClick={() => send("change", { id: fare.id, change: c })}>₵{c}</button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">No fares right now. Pick up passengers to make money.</p>
        )}
      </div>
      <div className="pad two">
        <button className="btn ghost" onClick={() => send("shout", { text: "Driver, take time!" })}>Take time!</button>
        <button className="btn ghost" onClick={() => send("shout", { text: "Shift small, somebody dey come!" })}>Shift small!</button>
      </div>
    </>
  );
}

function changeOptions(correct: number) {
  const set = new Set([correct, correct + 1, Math.max(0, correct - 1), correct + 5, Math.max(0, correct - 2)]);
  return [...set].slice(0, 4).sort((a, b) => a - b);
}

function PassengerPad({ state, id, send }: { state: any; id: string; send: (a: string, d?: any) => void }) {
  const me = state.pax?.[id];
  if (!me) return <div className="panel grow"><p className="muted">Climbing aboard...</p></div>;
  const close = me.distance < 120;
  return (
    <>
      <div className="panel">
        <h3>You are going to</h3>
        <div className="big">{me.dest}</div>
        <p className="muted" style={{ margin: "6px 0 0" }}>{me.distance} m away · {me.trips} trips done · {me.missed} missed</p>
      </div>
      <div className="panel">
        <h3>Secret mission</h3>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>{me.mission}</p>
      </div>
      <div className="grow" />
      <button className={`btn huge ${close ? "red" : "ghost"}`} onClick={() => send("busstop")}>
        {me.called ? "You called it ✓" : "Mate, bus stop!"}
      </button>
      <div className="pad two">
        <button className="btn ghost" onClick={() => send("shout", { text: "Driver, take am easy!" })}>Take am easy</button>
        <button className="btn ghost" onClick={() => send("shout", { text: "Mate, my change!" })}>My change!</button>
      </div>
    </>
  );
}
