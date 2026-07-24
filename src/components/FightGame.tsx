import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MoveType = "punch" | "kick" | "block" | "dodge" | "aerial" | "special";
type Fighter = "player" | "enemy";

interface Move {
  type: MoveType;
  word: string;
  damage: number;
  label: string;
  color: string;
}

interface FloatText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
}

interface Spark {
  id: number;
  x: number;
  y: number;
  color: string;
}

type Difficulty = "rookie" | "brawler" | "master";

const WORDS_SHORT = ["jab", "hit", "kick", "duck", "flip", "spin", "dash", "slam", "grab", "hook"];
const WORDS_MED = ["combo", "strike", "uppercut", "sidestep", "counter", "parry", "smash", "impact"];
const WORDS_LONG = ["hurricane", "devastator", "supernova", "cyberstrike", "neonfury", "obliterate"];

const MOVES: Record<MoveType, { label: string; color: string; damage: number; pool: string[] }> = {
  punch:   { label: "PUNCH",    color: "var(--neon-cyan)",   damage: 6,  pool: WORDS_SHORT },
  kick:    { label: "KICK",     color: "var(--neon-yellow)", damage: 9,  pool: WORDS_SHORT },
  block:   { label: "BLOCK",    color: "var(--neon-cyan)",   damage: 0,  pool: ["guard", "block", "shield"] },
  dodge:   { label: "DODGE",    color: "var(--neon-purple)", damage: 0,  pool: ["dodge", "evade", "roll"] },
  aerial:  { label: "AERIAL",   color: "var(--neon-pink)",   damage: 14, pool: WORDS_MED },
  special: { label: "SPECIAL",  color: "var(--neon-pink)",   damage: 28, pool: WORDS_LONG },
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateMove(forceSpecial = false): Move {
  if (forceSpecial) {
    const w = pick(MOVES.special.pool);
    return { type: "special", word: w, damage: MOVES.special.damage, label: MOVES.special.label, color: MOVES.special.color };
  }
  const roll = Math.random();
  let type: MoveType;
  if (roll < 0.35) type = "punch";
  else if (roll < 0.6) type = "kick";
  else if (roll < 0.75) type = "aerial";
  else if (roll < 0.87) type = "block";
  else type = "dodge";
  const cfg = MOVES[type];
  return { type, word: pick(cfg.pool), damage: cfg.damage, label: cfg.label, color: cfg.color };
}

const DIFFICULTY: Record<Difficulty, { interval: [number, number]; damageMult: number; label: string }> = {
  rookie:  { interval: [1600, 2600], damageMult: 0.7, label: "ROOKIE" },
  brawler: { interval: [1000, 1800], damageMult: 1.0, label: "BRAWLER" },
  master:  { interval: [650, 1200],  damageMult: 1.35, label: "MASTER" },
};

// ---------- Fighter SVG ----------
function FighterSprite({
  side,
  pose,
  hurt,
  color,
  accent,
}: {
  side: "left" | "right";
  pose: "idle" | "punch" | "kick" | "block" | "dodge" | "aerial" | "special" | "hurt" | "ko";
  hurt: boolean;
  color: string;
  accent: string;
}) {
  // Simple vector fighter, stylized, poses via transforms
  const flip = side === "right" ? -1 : 1;
  const armAngle =
    pose === "punch" ? 90 :
    pose === "aerial" ? 130 :
    pose === "special" ? 110 :
    pose === "block" ? -20 :
    pose === "hurt" ? -60 :
    30;
  const legAngle =
    pose === "kick" ? 80 :
    pose === "aerial" ? 60 :
    pose === "dodge" ? -30 : 10;
  const yOffset = pose === "aerial" ? -60 : pose === "dodge" ? 10 : 0;
  const xLean = pose === "hurt" ? -15 * flip : pose === "punch" ? 12 * flip : pose === "kick" ? 8 * flip : 0;
  const opacity = pose === "ko" ? 0.5 : 1;

  return (
    <div
      className="relative"
      style={{
        transform: `translate(${xLean}px, ${yOffset}px) scaleX(${flip})`,
        transition: "transform 120ms ease-out",
        filter: hurt ? "hue-rotate(-40deg) brightness(1.6)" : undefined,
        opacity,
      }}
    >
      <svg viewBox="-100 -180 200 200" width="220" height="260" style={{ overflow: "visible" }}>
        {/* shadow */}
        <ellipse cx="0" cy="15" rx="55" ry="8" fill="black" opacity="0.5" />
        {/* back leg */}
        <g transform={`translate(-8, -40) rotate(${-legAngle * 0.4})`}>
          <rect x="-8" y="0" width="16" height="55" rx="6" fill={color} />
          <rect x="-10" y="50" width="24" height="10" rx="3" fill={accent} />
        </g>
        {/* front leg */}
        <g transform={`translate(10, -40) rotate(${legAngle})`}>
          <rect x="-8" y="0" width="16" height="55" rx="6" fill={color} />
          <rect x="-10" y="50" width="26" height="10" rx="3" fill={accent} />
        </g>
        {/* torso */}
        <path d="M -28 -95 L 28 -95 L 34 -40 L -34 -40 Z" fill={color} />
        <path d="M -28 -95 L 28 -95 L 20 -75 L -20 -75 Z" fill={accent} opacity="0.8" />
        <rect x="-4" y="-95" width="8" height="55" fill={accent} opacity="0.6" />
        {/* back arm */}
        <g transform={`translate(-24, -90) rotate(${-armAngle * 0.5})`}>
          <rect x="-7" y="0" width="14" height="45" rx="6" fill={color} opacity="0.85" />
          <circle cx="0" cy="48" r="10" fill={accent} />
        </g>
        {/* head */}
        <g transform={`translate(0, -115)`}>
          <circle cx="0" cy="0" r="22" fill={color} />
          <path d="M -22 -6 Q 0 -28 22 -6 L 20 -14 L -20 -14 Z" fill={accent} />
          {/* visor */}
          <rect x="-16" y="-4" width="32" height="8" rx="2" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
          <rect x="-14" y="-3" width="6" height="6" fill="white" opacity="0.9" />
        </g>
        {/* front arm (attack arm) */}
        <g transform={`translate(24, -90) rotate(${armAngle})`}>
          <rect x="-7" y="0" width="14" height="45" rx="6" fill={color} />
          <circle cx="0" cy="48" r="12" fill={accent} style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
          {(pose === "punch" || pose === "special" || pose === "aerial") && (
            <g transform="translate(0, 55)">
              <path d="M -18 0 L 30 -6 L 30 6 Z" fill={accent} opacity="0.7" />
              <path d="M -8 -12 L 24 -14 L 24 14 L -8 12 Z" fill="white" opacity="0.25" />
            </g>
          )}
        </g>
        {/* block shield */}
        {pose === "block" && (
          <g>
            <rect x="20" y="-100" width="14" height="70" rx="6" fill={accent} opacity="0.85" style={{ filter: `drop-shadow(0 0 12px ${accent})` }} />
          </g>
        )}
        {/* special charge */}
        {pose === "special" && (
          <>
            <circle cx="60" cy="-70" r="26" fill={accent} opacity="0.3">
              <animate attributeName="r" values="18;32;18" dur="0.6s" repeatCount="indefinite" />
            </circle>
            <circle cx="60" cy="-70" r="14" fill="white" opacity="0.9" />
          </>
        )}
      </svg>
    </div>
  );
}

// ---------- HUD parts ----------
function HealthBar({ hp, max, label, side, combo, meter }: { hp: number; max: number; label: string; side: "left" | "right"; combo: number; meter: number }) {
  const pct = Math.max(0, hp) / max * 100;
  const color = pct > 60 ? "var(--hp-green)" : pct > 30 ? "var(--hp-orange)" : "var(--hp-red)";
  return (
    <div className={`flex-1 ${side === "right" ? "items-end text-right" : "items-start"} flex flex-col gap-1`}>
      <div className={`flex items-center gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
        <div className="text-2xl font-black tracking-widest" style={{ color: "var(--neon-cyan)", textShadow: "0 0 8px currentColor" }}>{label}</div>
        <div className="text-xs font-mono opacity-70">COMBO x{combo}</div>
      </div>
      <div className="relative w-full h-6 border-2" style={{ borderColor: "var(--neon-cyan)", background: "rgba(0,0,0,0.6)", boxShadow: "0 0 12px var(--neon-cyan) inset" }}>
        <div
          className="absolute top-0 h-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            [side === "right" ? "right" : "left"]: 0,
            background: `linear-gradient(90deg, ${color}, oklch(0.98 0.05 95))`,
            boxShadow: `0 0 16px ${color}`,
          }}
        />
        <div className="absolute inset-0 opacity-20" style={{ background: "repeating-linear-gradient(90deg, transparent 0 8px, black 8px 9px)" }} />
      </div>
      <div className="relative w-2/3 h-2 border" style={{ borderColor: "var(--neon-pink)", background: "rgba(0,0,0,0.6)" }}>
        <div
          className="absolute top-0 h-full transition-all duration-200"
          style={{
            width: `${meter}%`,
            [side === "right" ? "right" : "left"]: 0,
            background: "linear-gradient(90deg, var(--neon-pink), var(--neon-yellow))",
            boxShadow: "0 0 10px var(--neon-pink)",
          }}
        />
      </div>
    </div>
  );
}

// ---------- Main Game ----------
export function FightGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("brawler");
  const [phase, setPhase] = useState<"menu" | "ready" | "fight" | "ko" | "victory">("menu");
  const [round, setRound] = useState(1);

  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [combo, setCombo] = useState(0);
  const [meter, setMeter] = useState(0);
  const [best, setBest] = useState(0);

  const [currentMove, setCurrentMove] = useState<Move>(() => generateMove());
  const [typed, setTyped] = useState("");
  const [playerPose, setPlayerPose] = useState<"idle" | MoveType | "hurt" | "ko">("idle");
  const [enemyPose, setEnemyPose] = useState<"idle" | MoveType | "hurt" | "ko">("idle");
  const [enemyAttackIn, setEnemyAttackIn] = useState<number>(2000);
  const [enemyIncoming, setEnemyIncoming] = useState<MoveType | null>(null);
  const [defensePose, setDefensePose] = useState<"block" | "dodge" | null>(null);

  const [shake, setShake] = useState(0);
  const [slowmo, setSlowmo] = useState(false);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const idRef = useRef(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const poseTimerRef = useRef<number | null>(null);
  const enemyPoseTimerRef = useRef<number | null>(null);

  // Auto focus input during fight
  useEffect(() => {
    if (phase === "fight") inputRef.current?.focus();
  }, [phase, currentMove]);

  const addFloat = useCallback((text: string, side: "left" | "right", color: string, size = 32) => {
    const id = ++idRef.current;
    const x = side === "left" ? 25 + Math.random() * 15 : 60 + Math.random() * 15;
    const y = 40 + Math.random() * 10;
    setFloats(f => [...f, { id, text, x, y, color, size }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 900);
  }, []);

  const addSpark = useCallback((side: "left" | "right", color: string) => {
    const id = ++idRef.current;
    const x = side === "left" ? 32 + Math.random() * 10 : 58 + Math.random() * 10;
    const y = 45 + Math.random() * 8;
    setSparks(s => [...s, { id, x, y, color }]);
    setTimeout(() => setSparks(s => s.filter(x => x.id !== id)), 400);
  }, []);

  const triggerShake = useCallback((intensity = 1) => {
    setShake(intensity);
    setTimeout(() => setShake(0), 350);
  }, []);

  const setPose = useCallback((who: Fighter, pose: MoveType | "hurt" | "idle" | "ko", ms = 300) => {
    if (who === "player") {
      setPlayerPose(pose);
      if (poseTimerRef.current) window.clearTimeout(poseTimerRef.current);
      if (pose !== "ko" && pose !== "idle") {
        poseTimerRef.current = window.setTimeout(() => setPlayerPose("idle"), ms);
      }
    } else {
      setEnemyPose(pose);
      if (enemyPoseTimerRef.current) window.clearTimeout(enemyPoseTimerRef.current);
      if (pose !== "ko" && pose !== "idle") {
        enemyPoseTimerRef.current = window.setTimeout(() => setEnemyPose("idle"), ms);
      }
    }
  }, []);

  // Enemy attack loop
  useEffect(() => {
    if (phase !== "fight") return;
    let cancelled = false;
    const [lo, hi] = DIFFICULTY[difficulty].interval;
    const delay = lo + Math.random() * (hi - lo);
    setEnemyAttackIn(delay);
    const warnAt = Math.max(600, delay - 700);
    const warnT = window.setTimeout(() => {
      if (cancelled) return;
      const type: MoveType = Math.random() < 0.3 ? "kick" : Math.random() < 0.5 ? "aerial" : "punch";
      setEnemyIncoming(type);
    }, warnAt);
    const t = window.setTimeout(() => {
      if (cancelled) return;
      // enemy attacks
      const type = enemyIncoming ?? "punch";
      setPose("enemy", type, 350);
      const base = MOVES[type].damage * DIFFICULTY[difficulty].damageMult;
      // Check defense
      let dmg = base;
      if (defensePose === "block") dmg = base * 0.15;
      else if (defensePose === "dodge") dmg = 0;
      setTimeout(() => {
        addSpark("left", defensePose === "block" ? "var(--neon-cyan)" : "var(--neon-yellow)");
        if (dmg > 0) {
          setPlayerHp(hp => Math.max(0, hp - Math.round(dmg)));
          setPose("player", "hurt", 300);
          addFloat(`-${Math.round(dmg)}`, "left", "var(--hp-red)", 28);
          triggerShake(1);
          setCombo(0);
        } else if (defensePose === "dodge") {
          addFloat("DODGE!", "left", "var(--neon-purple)", 28);
        } else if (defensePose === "block") {
          addFloat("BLOCK!", "left", "var(--neon-cyan)", 26);
          addFloat(`-${Math.round(dmg)}`, "left", "var(--hp-red)", 22);
          setPlayerHp(hp => Math.max(0, hp - Math.round(dmg)));
        }
        setEnemyIncoming(null);
        setDefensePose(null);
      }, 180);
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.clearTimeout(warnT);
    };
    // key deps: refresh whenever these change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, difficulty, enemyHp, playerHp, round]);

  // KO detection
  useEffect(() => {
    if (phase !== "fight") return;
    if (enemyHp <= 0) {
      setEnemyPose("ko");
      setSlowmo(true);
      setFlash("K.O.");
      triggerShake(1);
      setTimeout(() => {
        setSlowmo(false);
        setFlash(null);
        setPhase("victory");
      }, 1800);
    } else if (playerHp <= 0) {
      setPlayerPose("ko");
      setSlowmo(true);
      setFlash("DEFEAT");
      triggerShake(1);
      setTimeout(() => {
        setSlowmo(false);
        setFlash(null);
        setPhase("ko");
      }, 1800);
    }
  }, [enemyHp, playerHp, phase, triggerShake]);

  // Handle typing input
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (phase !== "fight") return;
    const val = e.target.value.toLowerCase();
    const target = currentMove.word.toLowerCase();

    // detect wrong char
    if (!target.startsWith(val)) {
      // stumble
      setPose("player", "hurt", 250);
      setCombo(0);
      setPlayerHp(hp => Math.max(0, hp - 2));
      addFloat("MISS", "left", "var(--hp-red)", 22);
      setTyped("");
      // pick new word to keep flow moving
      setCurrentMove(generateMove());
      return;
    }

    setTyped(val);

    if (val === target) {
      // Executed move
      const isSpecial = currentMove.type === "special";
      const isDefense = currentMove.type === "block" || currentMove.type === "dodge";
      if (isDefense) {
        setDefensePose(currentMove.type as "block" | "dodge");
        setPose("player", currentMove.type, 500);
        addFloat(currentMove.type.toUpperCase() + "!", "left", currentMove.color, 24);
      } else {
        // damage enemy
        const comboMult = 1 + combo * 0.05;
        const dmg = Math.round(currentMove.damage * comboMult);
        setPose("player", currentMove.type, 300);
        setTimeout(() => {
          setEnemyHp(hp => Math.max(0, hp - dmg));
          setPose("enemy", "hurt", 250);
          addSpark("right", currentMove.color);
          addFloat(`-${dmg}`, "right", "var(--neon-yellow)", isSpecial ? 44 : 30);
          if (currentMove.label !== "PUNCH") addFloat(currentMove.label, "right", currentMove.color, 22);
          triggerShake(isSpecial ? 1 : 0.6);
          if (isSpecial) {
            setSlowmo(true);
            setFlash("ULTIMATE!");
            setTimeout(() => { setSlowmo(false); setFlash(null); }, 800);
          }
        }, 120);
      }

      const newCombo = combo + 1;
      setCombo(newCombo);
      setBest(b => Math.max(b, newCombo));

      // Meter fills; special uses meter
      let nextMeter = meter;
      if (isSpecial) nextMeter = 0;
      else nextMeter = Math.min(100, meter + (isDefense ? 4 : 8) + newCombo);
      setMeter(nextMeter);

      setTyped("");
      // Auto-serve special if meter is full and combo >= 5
      const forceSpecial = nextMeter >= 100 && newCombo >= 3 && Math.random() < 0.5;
      setCurrentMove(generateMove(forceSpecial));
    }
  };

  const startFight = (d: Difficulty) => {
    setDifficulty(d);
    setPlayerHp(100); setEnemyHp(100);
    setCombo(0); setMeter(0);
    setPlayerPose("idle"); setEnemyPose("idle");
    setCurrentMove(generateMove());
    setTyped("");
    setPhase("ready");
    setFlash("READY?");
    setTimeout(() => setFlash("FIGHT!"), 900);
    setTimeout(() => { setFlash(null); setPhase("fight"); }, 1700);
  };

  const rematch = () => {
    setRound(r => r + 1);
    startFight(difficulty);
  };

  // Progress bar for current word
  const progress = currentMove.word.length ? (typed.length / currentMove.word.length) * 100 : 0;

  return (
    <main
      className={`relative min-h-screen w-full overflow-hidden font-mono select-none ${shake ? "animate-shake" : ""}`}
      style={{
        background: "var(--arena-bg)",
        color: "var(--foreground)",
        transition: slowmo ? "filter 0.2s" : undefined,
        filter: slowmo ? "saturate(1.6) contrast(1.15)" : undefined,
      }}
      onClick={() => inputRef.current?.focus()}
    >
      <ArenaBackdrop />

      {/* Top HUD */}
      <header className="relative z-20 px-6 pt-5">
        <div className="flex items-center justify-between gap-6">
          <HealthBar hp={playerHp} max={100} label="YOU" side="left" combo={combo} meter={meter} />
          <div className="flex flex-col items-center px-3">
            <div className="text-[10px] tracking-[0.3em] opacity-70">ROUND</div>
            <div className="text-4xl font-black" style={{ color: "var(--neon-yellow)", textShadow: "0 0 12px var(--neon-yellow)" }}>{round.toString().padStart(2, "0")}</div>
            <div className="text-[10px] tracking-[0.3em] opacity-70 mt-1">{DIFFICULTY[difficulty].label}</div>
          </div>
          <HealthBar hp={enemyHp} max={100} label="A.I." side="right" combo={0} meter={enemyHp} />
        </div>
      </header>

      {/* Stage */}
      <section className="relative z-10 mx-auto mt-10 flex h-[46vh] max-w-6xl items-end justify-between px-16">
        {/* Player */}
        <div className="relative">
          <FighterSprite side="left" pose={playerPose} hurt={playerPose === "hurt"} color="oklch(0.35 0.2 260)" accent="var(--neon-cyan)" />
        </div>
        {/* Enemy */}
        <div className="relative">
          {enemyIncoming && (
            <div className="absolute -top-8 right-1/2 translate-x-1/2 text-xs font-bold px-2 py-1 border" style={{ borderColor: "var(--neon-pink)", color: "var(--neon-pink)", background: "rgba(0,0,0,0.6)" }}>
              ! {enemyIncoming.toUpperCase()} !
            </div>
          )}
          <FighterSprite side="right" pose={enemyPose} hurt={enemyPose === "hurt"} color="oklch(0.3 0.18 20)" accent="var(--neon-pink)" />
        </div>

        {/* Floats */}
        {floats.map(f => (
          <div
            key={f.id}
            className="absolute animate-floatup font-black pointer-events-none"
            style={{
              left: `${f.x}%`, top: `${f.y}%`,
              color: f.color,
              fontSize: f.size,
              textShadow: `0 0 12px ${f.color}, 2px 2px 0 black`,
              WebkitTextStroke: "1.5px black",
            }}
          >
            {f.text}
          </div>
        ))}
        {/* Sparks */}
        {sparks.map(s => (
          <div key={s.id} className="absolute pointer-events-none animate-hitspark" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <svg width="120" height="120" viewBox="-60 -60 120 120">
              <g style={{ filter: `drop-shadow(0 0 12px ${s.color})` }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <path
                    key={i}
                    d="M 0 -40 L 8 -8 L 40 0 L 8 8 L 0 40 L -8 8 L -40 0 L -8 -8 Z"
                    fill={s.color}
                    transform={`rotate(${i * 45}) scale(${0.4 + (i % 2) * 0.3})`}
                    opacity={0.9 - i * 0.05}
                  />
                ))}
                <circle cx="0" cy="0" r="14" fill="white" />
              </g>
            </svg>
          </div>
        ))}

        {/* Big flash */}
        {flash && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div
              className="text-8xl font-black tracking-widest animate-neon"
              style={{
                color: flash === "DEFEAT" ? "var(--hp-red)" : flash === "K.O." ? "var(--neon-yellow)" : "var(--neon-pink)",
                textShadow: "0 0 30px currentColor",
                WebkitTextStroke: "2px black",
              }}
            >
              {flash}
            </div>
          </div>
        )}
      </section>

      {/* Bottom typing dock */}
      <footer className="relative z-20 mt-6 px-6 pb-6">
        <div className="mx-auto max-w-4xl border-2 p-4" style={{ borderColor: currentMove.color, background: "rgba(0,0,0,0.65)", boxShadow: `0 0 24px ${currentMove.color}` }}>
          <div className="flex items-center justify-between text-xs tracking-[0.3em] opacity-80">
            <span style={{ color: currentMove.color, textShadow: "0 0 8px currentColor" }}>▶ {currentMove.label}</span>
            <span>DMG {currentMove.damage} · COMBO x{combo} · BEST {best}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-4xl md:text-5xl font-black tracking-[0.15em]">
            {currentMove.word.split("").map((ch, i) => {
              const done = i < typed.length;
              const current = i === typed.length;
              return (
                <span
                  key={i}
                  style={{
                    color: done ? currentMove.color : current ? "white" : "rgba(255,255,255,0.35)",
                    textShadow: done ? `0 0 12px ${currentMove.color}` : current ? "0 0 8px white" : undefined,
                    borderBottom: current ? `3px solid ${currentMove.color}` : undefined,
                  }}
                >
                  {ch.toUpperCase()}
                </span>
              );
            })}
          </div>
          <div className="mt-3 h-1 w-full" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div className="h-full transition-all duration-100" style={{ width: `${progress}%`, background: currentMove.color, boxShadow: `0 0 10px ${currentMove.color}` }} />
          </div>
          <input
            ref={inputRef}
            value={typed}
            onChange={onChange}
            autoFocus
            aria-label="Type the move"
            className="sr-only"
          />
        </div>
        <p className="text-center text-xs opacity-60 mt-3 tracking-widest">TYPE THE WORD TO ATTACK · BLOCK/DODGE WHEN A.I. WINDS UP · CHAIN COMBOS FOR ULTIMATES</p>
      </footer>

      {/* Menu / overlays */}
      {phase === "menu" && (
        <Overlay>
          <Title />
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="text-xs tracking-[0.4em] opacity-70">SELECT DIFFICULTY</div>
            <div className="flex gap-3">
              {(["rookie", "brawler", "master"] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => startFight(d)}
                  className="px-6 py-3 border-2 font-black tracking-widest hover:scale-105 transition-transform"
                  style={{
                    borderColor: d === "master" ? "var(--neon-pink)" : d === "brawler" ? "var(--neon-yellow)" : "var(--neon-cyan)",
                    color: d === "master" ? "var(--neon-pink)" : d === "brawler" ? "var(--neon-yellow)" : "var(--neon-cyan)",
                    background: "rgba(0,0,0,0.6)",
                    boxShadow: `0 0 20px ${d === "master" ? "var(--neon-pink)" : d === "brawler" ? "var(--neon-yellow)" : "var(--neon-cyan)"}`,
                  }}
                >
                  {DIFFICULTY[d].label}
                </button>
              ))}
            </div>
            <p className="mt-6 max-w-md text-center text-sm opacity-70 leading-relaxed">
              Every keystroke is a strike. Type <span style={{ color: "var(--neon-cyan)" }}>attack words</span> to unleash punches, kicks and aerials. Type <span style={{ color: "var(--neon-purple)" }}>BLOCK</span> or <span style={{ color: "var(--neon-purple)" }}>DODGE</span> to counter incoming attacks. Chain hits for ultimates.
            </p>
          </div>
        </Overlay>
      )}

      {phase === "victory" && (
        <Overlay>
          <div className="text-6xl font-black tracking-widest mb-4" style={{ color: "var(--neon-yellow)", textShadow: "0 0 20px currentColor" }}>VICTORY</div>
          <div className="text-sm tracking-widest opacity-80">BEST COMBO · {best}</div>
          <button onClick={rematch} className="mt-8 px-8 py-3 border-2 font-black tracking-widest hover:scale-105 transition-transform" style={{ borderColor: "var(--neon-pink)", color: "var(--neon-pink)", background: "rgba(0,0,0,0.6)", boxShadow: "0 0 20px var(--neon-pink)" }}>REMATCH</button>
          <button onClick={() => setPhase("menu")} className="mt-3 text-xs opacity-70 tracking-widest hover:opacity-100">CHANGE DIFFICULTY</button>
        </Overlay>
      )}

      {phase === "ko" && (
        <Overlay>
          <div className="text-6xl font-black tracking-widest mb-4" style={{ color: "var(--hp-red)", textShadow: "0 0 20px currentColor" }}>YOU LOSE</div>
          <div className="text-sm tracking-widest opacity-80">BEST COMBO · {best}</div>
          <button onClick={rematch} className="mt-8 px-8 py-3 border-2 font-black tracking-widest hover:scale-105 transition-transform" style={{ borderColor: "var(--neon-cyan)", color: "var(--neon-cyan)", background: "rgba(0,0,0,0.6)", boxShadow: "0 0 20px var(--neon-cyan)" }}>TRY AGAIN</button>
          <button onClick={() => setPhase("menu")} className="mt-3 text-xs opacity-70 tracking-widest hover:opacity-100">CHANGE DIFFICULTY</button>
        </Overlay>
      )}
    </main>
  );
}

function Title() {
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs tracking-[0.5em] opacity-70">NEON DOJO PRESENTS</div>
      <h1 className="text-7xl md:text-8xl font-black tracking-[0.1em] mt-2 animate-neon" style={{ color: "var(--neon-pink)" }}>KEYSTRIKE</h1>
      <div className="mt-2 text-sm tracking-[0.4em]" style={{ color: "var(--neon-cyan)" }}>TYPING FIGHTER · 1 v A.I.</div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.7)" }}>
      {children}
    </div>
  );
}

// Neon cyberpunk arena background
function ArenaBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* sun */}
      <div className="absolute left-1/2 top-[8%] -translate-x-1/2 w-[520px] h-[520px] rounded-full opacity-70"
        style={{
          background: "radial-gradient(circle, oklch(0.85 0.22 30) 0%, oklch(0.6 0.28 340) 40%, transparent 70%)",
          filter: "blur(2px)",
        }} />
      {/* stripes on sun */}
      <div className="absolute left-1/2 top-[24%] -translate-x-1/2 w-[400px] h-[300px] opacity-60"
        style={{
          background: "repeating-linear-gradient(0deg, transparent 0 18px, black 18px 26px)",
          maskImage: "radial-gradient(circle at 50% 30%, black 40%, transparent 65%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 30%, black 40%, transparent 65%)",
        }} />
      {/* skyline */}
      <div className="absolute inset-x-0 top-[38%] h-[22%] opacity-80"
        style={{
          background: `
            linear-gradient(to top, oklch(0.1 0.05 280) 0%, transparent 100%),
            repeating-linear-gradient(90deg,
              oklch(0.18 0.08 290) 0 40px, oklch(0.14 0.06 280) 40px 44px,
              oklch(0.2 0.1 300) 44px 88px, oklch(0.12 0.05 270) 88px 92px,
              oklch(0.16 0.08 320) 92px 150px, oklch(0.1 0.04 260) 150px 158px)
          `,
          clipPath: "polygon(0 30%, 4% 30%, 4% 20%, 10% 20%, 10% 10%, 16% 10%, 16% 25%, 22% 25%, 22% 5%, 28% 5%, 28% 20%, 36% 20%, 36% 12%, 44% 12%, 44% 30%, 52% 30%, 52% 8%, 60% 8%, 60% 22%, 68% 22%, 68% 15%, 76% 15%, 76% 5%, 84% 5%, 84% 25%, 92% 25%, 92% 18%, 100% 18%, 100% 100%, 0 100%)",
        }} />
      {/* neon window dots */}
      <div className="absolute inset-x-0 top-[42%] h-[18%] opacity-70"
        style={{
          backgroundImage: "radial-gradient(oklch(0.9 0.25 200) 1px, transparent 2px), radial-gradient(oklch(0.85 0.25 340) 1px, transparent 2px)",
          backgroundSize: "18px 24px, 22px 30px",
          backgroundPosition: "0 0, 6px 12px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)",
        }} />
      {/* grid floor */}
      <div className="absolute inset-x-0 bottom-0 h-[38%]" style={{ perspective: "600px" }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0.85 0.25 200 / 0.6) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.85 0.25 340 / 0.5) 1px, transparent 1px)
            `,
            backgroundSize: "60px 40px, 60px 40px",
            transform: "rotateX(65deg)",
            transformOrigin: "bottom",
            animation: "scanline 1.2s linear infinite",
          }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, oklch(0.1 0.05 280) 20%, transparent 100%)" }} />
      </div>
      {/* vignette */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)" }} />
    </div>
  );
}