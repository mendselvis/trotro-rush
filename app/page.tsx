"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <main className="home">
      <div className="home-card">
        <div className="rear">
          <div className="rear-window">
            <h1 className="display">Trotro Rush</h1>
          </div>
          <span className="sticker">No condition is permanent</span>
          <div className="lights"><span /><span /></div>
        </div>

        <p className="lead">
          One friend drives. One is the mate shouting stops and sharing change. Everyone else is a passenger with a secret mission.
          Open it on a laptop, join on your phones, and try not to crash at Kaneshie.
        </p>

        <button className="btn" style={{ width: "100%" }} onClick={() => router.push("/host")}>
          Host a trip on this screen
        </button>

        <form
          className="join-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length === 4) router.push(`/join/${code.trim().toUpperCase()}`);
          }}
        >
          <input
            className="field"
            placeholder="CODE"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, ""))}
            aria-label="Room code"
          />
          <button className="btn green" type="submit" disabled={code.length !== 4}>Join</button>
        </form>
      </div>
    </main>
  );
}
