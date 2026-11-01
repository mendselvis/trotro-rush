import { ROUTE, FARE, ROUND_SECONDS, CRUISE, CAPACITY } from "./constants";

export type ObstacleKind = "pothole" | "car" | "police";

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  pos: number; // metres along the road
  lane: number; // 0..2, ignored for police (whole road)
  speed: number;
  hit: boolean;
  color: string;
}

export interface Stop {
  idx: number;
  name: string;
  pos: number;
  waiting: number;
  served: boolean;
  passed: boolean;
}

export interface Pax {
  id: string;
  name: string;
  dest: number; // stop idx
  mission: string;
  called: boolean;
  trips: number;
  missed: number;
}

export interface FareTask {
  id: number;
  fare: number;
  paid: number;
  createdAt: number;
}

export interface Bubble {
  id: number;
  who: string;
  text: string;
  kind: "driver" | "mate" | "passenger" | "police" | "system";
  at: number;
}

export interface Stats {
  fares: number;
  cedis: number;
  wrongChange: number;
  dodged: number;
  missedStops: number;
  servedStops: number;
  crashes: number;
  potholes: number;
  policeFines: number;
  happyDrops: number;
  honks: number;
}

const CAR_COLORS = ["#E4572E", "#2E6FD8", "#F2F2F2", "#7A4EAB", "#1F9E89", "#C0C0C0"];
const rand = (n: number) => Math.floor(Math.random() * n);

export class Game {
  dist = 0;
  speed = 0;
  lane = 1;
  laneVis = 1; // smoothed lane for drawing
  braking = false;
  time = 0;
  duration = ROUND_SECONDS;
  over = false;
  score = 0;
  shake = 0;

  stops: Stop[] = [];
  obstacles: Obstacle[] = [];
  riders: number[] = []; // NPC passengers, each value is their destination stop idx
  pax: Record<string, Pax> = {};
  fares: FareTask[] = [];
  bubbles: Bubble[] = [];
  called = new Set<number>();
  stats: Stats = {
    fares: 0, cedis: 0, wrongChange: 0, dodged: 0, missedStops: 0, servedStops: 0,
    crashes: 0, potholes: 0, policeFines: 0, happyDrops: 0, honks: 0,
  };

  private nextId = 1;
  private spawnPos = 90;
  onSound?: (s: "horn" | "crash" | "coin" | "whistle") => void;

  constructor(passengers: { id: string; name: string }[], missions: string[]) {
    for (let i = 0; i < 60; i++) {
      this.stops.push({ idx: i, name: ROUTE[i % ROUTE.length], pos: 200 + i * 230, waiting: 1 + rand(3), served: false, passed: false });
    }
    for (let i = 0; i < 5; i++) this.riders.push(1 + rand(3));
    passengers.forEach((p, i) => this.addPax(p.id, p.name, missions[i % Math.max(1, missions.length)] ?? ""));
  }

  addPax(id: string, name: string, mission: string) {
    if (this.pax[id]) return;
    const next = this.nextStopIdx();
    this.pax[id] = { id, name, dest: next + 1 + rand(3), mission, called: false, trips: 0, missed: 0 };
  }

  nextStopIdx() {
    const s = this.stops.find((s) => !s.passed && !s.served);
    return s ? s.idx : 0;
  }

  private bubble(who: string, text: string, kind: Bubble["kind"]) {
    this.bubbles.push({ id: this.nextId++, who, text, kind, at: this.time });
    if (this.bubbles.length > 6) this.bubbles.shift();
  }

  // ---- player input -------------------------------------------------------
  input(playerId: string, role: string, a: string, data: any = {}) {
    if (this.over) return;
    if (role === "driver") {
      if (a === "left") this.lane = Math.max(0, this.lane - 1);
      if (a === "right") this.lane = Math.min(2, this.lane + 1);
      if (a === "brake_on") this.braking = true;
      if (a === "brake_off") this.braking = false;
      if (a === "horn") {
        this.stats.honks++;
        this.bubble("Driver", "PEEP PEEP!", "driver");
        this.onSound?.("horn");
      }
    }
    if (role === "mate") {
      if (a === "call" && typeof data.stop === "number") {
        const s = this.stops[data.stop];
        if (s && !s.passed) {
          this.called.add(s.idx);
          this.bubble("Mate", `${s.name}! ${s.name}! Bus stop!`, "mate");
        }
      }
      if (a === "change") this.giveChange(data.id, data.change);
      if (a === "shout" && data.text) this.bubble("Mate", String(data.text).slice(0, 40), "mate");
    }
    if (role === "passenger") {
      const p = this.pax[playerId];
      if (!p) return;
      if (a === "busstop") {
        p.called = true;
        this.bubble(p.name, "Mate, bus stop!", "passenger");
      }
      if (a === "shout" && data.text) this.bubble(p.name, String(data.text).slice(0, 40), "passenger");
    }
  }

  private giveChange(id: number, change: number) {
    const i = this.fares.findIndex((f) => f.id === id);
    if (i < 0) return;
    const f = this.fares[i];
    this.fares.splice(i, 1);
    const correct = f.paid - f.fare;
    if (change === correct) {
      this.score += f.fare;
      this.stats.fares++;
      this.stats.cedis += f.fare;
      this.onSound?.("coin");
    } else {
      this.stats.wrongChange++;
      const diff = Math.abs(change - correct);
      this.score += f.fare - diff - 1;
      this.stats.cedis += f.fare - (change > correct ? diff : 0);
      this.bubble("Passenger", change < correct ? "Mate, my change no complete oo!" : "Ei, extra change? God bless you!", "passenger");
    }
  }

  // ---- simulation ---------------------------------------------------------
  step(dt: number) {
    if (this.over) return;
    this.time += dt;
    if (this.time >= this.duration) {
      this.over = true;
      this.speed = 0;
      return;
    }

    const target = this.braking ? 0 : CRUISE;
    if (this.speed < target) this.speed = Math.min(target, this.speed + 6 * dt);
    else this.speed = Math.max(target, this.speed - (this.braking ? 16 : 6) * dt);
    this.dist += this.speed * dt;
    this.laneVis += (this.lane - this.laneVis) * Math.min(1, dt * 10);
    this.shake = Math.max(0, this.shake - dt);

    this.spawnObstacles();
    this.updateObstacles(dt);
    this.updateStops();

    // passengers who waited too long jump off without paying
    for (let i = this.fares.length - 1; i >= 0; i--) {
      if (this.time - this.fares[i].createdAt > 15) {
        this.fares.splice(i, 1);
        this.stats.dodged++;
        this.bubble("Passenger", "*slips off without paying*", "passenger");
      }
    }
    this.bubbles = this.bubbles.filter((b) => this.time - b.at < 3.5);
  }

  private spawnObstacles() {
    while (this.spawnPos < this.dist + 300) {
      this.spawnPos += 40 + Math.random() * 55;
      const nearStop = this.stops.some((s) => Math.abs(s.pos - this.spawnPos) < 45);
      const r = Math.random();
      let kind: ObstacleKind = r < 0.5 ? "pothole" : r < 0.9 ? "car" : "police";
      if (kind === "police" && nearStop) kind = "pothole";
      // keep the stop lane clear right before a stop
      let lane = rand(3);
      if (nearStop && lane === 2) lane = rand(2);
      this.obstacles.push({
        id: this.nextId++, kind, pos: this.spawnPos, lane,
        speed: kind === "car" ? 5 + Math.random() * 4 : 0, hit: false,
        color: CAR_COLORS[rand(CAR_COLORS.length)],
      });
    }
  }

  private updateObstacles(dt: number) {
    for (const o of this.obstacles) {
      if (o.kind === "car") o.pos += o.speed * dt;
      if (o.hit) continue;
      const d = o.pos - this.dist;
      if (o.kind === "police") {
        if (d < 2) {
          o.hit = true;
          if (this.speed > 6) {
            this.score -= 10;
            this.stats.policeFines++;
            this.bubble("Police", "Oya park! You dey speed. GH₵10.", "police");
            this.onSound?.("whistle");
          } else {
            this.bubble("Police", "Okay, move on. Drive safe.", "police");
          }
        }
        continue;
      }
      if (o.lane === Math.round(this.laneVis) && d < 6 && d > -4) {
        o.hit = true;
        if (o.kind === "pothole") {
          this.score -= 3;
          this.stats.potholes++;
          this.speed *= 0.5;
          this.shake = 0.35;
          this.bubble("Passenger", "Ei driver, the pothole!", "passenger");
        } else {
          this.score -= 6;
          this.stats.crashes++;
          this.speed = 1;
          this.shake = 0.7;
          this.bubble("Driver", "Who taught you how to drive?!", "driver");
          this.onSound?.("crash");
        }
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.pos > this.dist - 60);
  }

  private updateStops() {
    for (const s of this.stops) {
      if (s.passed || s.pos > this.dist + 20) continue;
      const inZone = this.dist > s.pos - 14 && this.dist < s.pos + 10;
      if (!s.served && inZone && this.lane === 2 && this.speed < 1.5) this.serveStop(s);
      if (this.dist > s.pos + 10) {
        s.passed = true;
        if (!s.served) this.missStop(s);
      }
    }
  }

  private serveStop(s: Stop) {
    s.served = true;
    this.stats.servedStops++;
    this.called.delete(s.idx);

    let alighted = 0;
    this.riders = this.riders.filter((d) => {
      if (d === s.idx) { alighted++; return false; }
      return true;
    });
    for (const p of Object.values(this.pax)) {
      if (p.dest !== s.idx) continue;
      alighted++;
      if (p.called) {
        this.score += 10;
        this.stats.happyDrops++;
        this.bubble(p.name, "Medaase! Right on time.", "passenger");
      } else {
        this.score += 4;
      }
      p.trips++;
      p.called = false;
      p.dest = s.idx + 2 + rand(3);
    }

    const room = CAPACITY - this.riders.length - Object.keys(this.pax).length;
    const boarding = Math.max(0, Math.min(s.waiting, room));
    const notes = [5, 5, 10, 10, 20, 4];
    for (let i = 0; i < boarding; i++) {
      this.riders.push(s.idx + 1 + rand(4));
      this.fares.push({ id: this.nextId++, fare: FARE, paid: notes[rand(notes.length)], createdAt: this.time });
    }
    s.waiting = 0;

    if (alighted === 0 && boarding === 0) {
      this.score -= 2;
      this.bubble("Passenger", "Why we dey stop here?", "passenger");
    } else {
      this.bubble("Mate", boarding ? `${boarding} in, ${alighted} out. Fare GH₵${FARE}!` : `${alighted} out!`, "mate");
    }
  }

  private missStop(s: Stop) {
    let missed = 0;
    this.riders = this.riders.filter((d) => {
      if (d === s.idx) { missed++; return false; }
      return true;
    });
    for (const p of Object.values(this.pax)) {
      if (p.dest !== s.idx) continue;
      missed++;
      p.missed++;
      p.called = false;
      p.dest = s.idx + 2 + rand(3);
    }
    if (missed > 0 || this.called.has(s.idx) || s.waiting > 0) {
      this.stats.missedStops++;
      this.score -= 4 + missed * 3;
      this.bubble("Passenger", `Driver! You pass ${s.name} oo!`, "passenger");
    }
    this.called.delete(s.idx);
  }

  // ---- data for phones and HUD -------------------------------------------
  snapshot() {
    const ahead = this.stops.filter((s) => !s.passed).slice(0, 4);
    const pax: Record<string, any> = {};
    for (const p of Object.values(this.pax)) {
      const dest = this.stops[p.dest];
      pax[p.id] = {
        dest: dest?.name ?? "",
        distance: dest ? Math.max(0, Math.round(dest.pos - this.dist)) : 0,
        mission: p.mission,
        called: p.called,
        trips: p.trips,
        missed: p.missed,
      };
    }
    return {
      t: "state",
      timeLeft: Math.max(0, Math.ceil(this.duration - this.time)),
      speed: Math.round(this.speed * 3.6),
      lane: this.lane,
      braking: this.braking,
      score: this.score,
      riders: this.riders.length + Object.keys(this.pax).length,
      stops: ahead.map((s) => ({
        idx: s.idx,
        name: s.name,
        distance: Math.max(0, Math.round(s.pos - this.dist)),
        waiting: s.waiting,
        alighting: this.riders.filter((d) => d === s.idx).length,
        called: this.called.has(s.idx),
        served: s.served,
      })),
      fares: this.fares.slice(0, 3),
      pax,
    };
  }
}
