import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sfx, unlockAudio, setMuted, isMuted } from "@/lib/chiptune";
import { net, type NetMove, generateRoomId } from "@/lib/net";
import { SpriteAnimation, type FighterPose } from "./SpriteAnimation";

type MoveType = "punch" | "kick" | "block" | "dodge" | "dash" | "aerial" | "special";
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

const WORDS_SHORT = ["jab", "hit", "kick", "duck", "flip", "spin", "dash", "slam", "grab", "hook"];
const WORDS_MED = ["combo", "strike", "uppercut", "sidestep", "counter", "parry", "smash", "impact"];
const WORDS_LONG = ["hurricane", "devastator", "supernova", "cyberstrike", "neonfury", "obliterate"];

const MOVES: Record<MoveType, { label: string; color: string; damage: number; pool: string[] }> = {
  punch:   { label: "PUNCH",    color: "var(--neon-cyan)",   damage: 6,  pool: WORDS_SHORT },
  kick:    { label: "KICK",     color: "var(--neon-yellow)", damage: 9,  pool: WORDS_SHORT },
  block:   { label: "BLOCK",    color: "var(--neon-cyan)",   damage: 0,  pool: ["guard", "block", "shield"] },
  dodge:   { label: "DODGE",    color: "var(--neon-purple)", damage: 0,  pool: ["dodge", "evade", "roll"] },
  dash:    { label: "DASH",     color: "var(--neon-cyan)",   damage: 5,  pool: ["dash", "rush", "slide"] },
  aerial:  { label: "AERIAL",   color: "var(--neon-pink)",   damage: 14, pool: WORDS_MED },
  special: { label: "SPECIAL",  color: "var(--neon-pink)",   damage: 28, pool: WORDS_LONG },
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function getRandomLetter(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return chars[Math.floor(Math.random() * chars.length)];
}

function generateUltimateSequence(): string[] {
  const seq: string[] = [];
  for (let i = 0; i < 5; i++) {
    seq.push(getRandomLetter());
  }
  return seq;
}

function generateMove(forceSpecial = false): Move {
  if (forceSpecial) {
    const w = pick(MOVES.special.pool);
    return { type: "special", word: w, damage: MOVES.special.damage, label: MOVES.special.label, color: MOVES.special.color };
  }
  const roll = Math.random();
  let type: MoveType;
  if (roll < 0.30) type = "punch";
  else if (roll < 0.50) type = "kick";
  else if (roll < 0.65) type = "dash";
  else if (roll < 0.80) type = "aerial";
  else if (roll < 0.90) type = "block";
  else type = "dodge";
  const cfg = MOVES[type];
  return { type, word: pick(cfg.pool), damage: cfg.damage, label: cfg.label, color: cfg.color };
}

// ---------- Fighter Sprite ----------
function FighterSprite({
  side,
  pose,
  hurt,
}: {
  side: "left" | "right";
  pose: FighterPose;
  hurt: boolean;
  color?: string;
  accent?: string;
}) {
  const spriteSrc = side === "left" ? "assets/sprites/player.png" : "assets/sprites/enemy.png";
  return (
    <SpriteAnimation
      src={spriteSrc}
      pose={pose}
      side={side}
      hurt={hurt}
    />
  );
}

// ---------- HUD parts ----------
function HealthBar({
  hp,
  max,
  label,
  side,
  combo,
  meter,
}: {
  hp: number;
  max: number;
  label: string;
  side: "left" | "right";
  combo: number;
  meter: number;
}) {
  const pct = Math.max(0, hp) / max * 100;
  const labelColor = side === "left" ? "var(--neon-cyan)" : "var(--hp-red)";
  
  return (
    <div className={`flex-1 flex flex-col gap-1.5 ${side === "right" ? "items-end" : "items-start"}`}>
      {/* Label and Combo Row */}
      <div className={`flex items-baseline gap-3 ${side === "right" ? "flex-row" : "flex-row"}`}>
        <div
          className="text-2xl font-black tracking-wider uppercase"
          style={{ color: labelColor, textShadow: `0 0 10px ${labelColor}` }}
        >
          {label}
        </div>
        <div className="text-xs font-mono text-white/80 tracking-wider">
          COMBO x{combo}
        </div>
      </div>

      {/* Segmented Pixel Health Bar */}
      <div
        className="relative w-full h-7 border-2 overflow-hidden"
        style={{
          borderColor: side === "left" ? "var(--neon-cyan)" : "var(--neon-pink)",
          background: "rgba(5, 5, 12, 0.95)",
          boxShadow: `0 0 12px ${side === "left" ? "rgba(0,255,255,0.3)" : "rgba(224,36,195,0.3)"}`,
        }}
      >
        {/* Lime Green Pixel Health Fill */}
        <div
          className="absolute top-0 h-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            [side === "right" ? "right" : "left"]: 0,
            background: "linear-gradient(180deg, #40ff00 0%, #2bd000 100%)",
            boxShadow: "0 0 12px #39ff14",
          }}
        />
        {/* Pixel Block Grid Dividers */}
        <div
          className="absolute inset-0 pointer-events-none opacity-90"
          style={{
            background: "repeating-linear-gradient(90deg, transparent 0px, transparent 10px, rgba(0,0,0,0.9) 10px, rgba(0,0,0,0.9) 12px)",
          }}
        />
      </div>

      {/* Meter Bar */}
      <div
        className="relative w-[92%] h-2.5 border overflow-hidden mt-0.5"
        style={{
          borderColor: "var(--neon-pink)",
          background: "rgba(5, 5, 12, 0.85)",
          boxShadow: "0 0 8px rgba(224, 36, 195, 0.3)",
        }}
      >
        <div
          className="absolute top-0 h-full transition-all duration-200"
          style={{
            width: `${meter}%`,
            [side === "right" ? "right" : "left"]: 0,
            background: "linear-gradient(90deg, var(--neon-purple), var(--neon-pink))",
            boxShadow: "0 0 10px var(--neon-pink)",
          }}
        />
      </div>
    </div>
  );
}

// ---------- Main Game ----------
export function FightGame() {
  const [phase, setPhase] = useState<"menu" | "lobby" | "hosting" | "ready" | "fight" | "ko" | "victory">("menu");
  const [roomId, setRoomId] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [round, setRound] = useState(1);

  // Match rounds and score state
  const [playerRoundWins, setPlayerRoundWins] = useState(0);
  const [opponentRoundWins, setOpponentRoundWins] = useState(0);

  // Match host state
  const [isHost, setIsHost] = useState(false);
  const isHostRef = useRef(false);

  // Ultimate Comeback states
  const [ultimateActive, setUltimateActive] = useState(false);
  const [ultimateExecuting, setUltimateExecuting] = useState(false);
  const [ultimateOwner, setUltimateOwner] = useState<"player" | "opponent" | null>(null);
  const [ultimateProgress, setUltimateProgress] = useState(0);
  const [opponentUltimateProgress, setOpponentUltimateProgress] = useState(0);
  const [ultimateSequence, setUltimateSequence] = useState<string[]>([]);
  const [ultimateTriggeredThisRound, setUltimateTriggeredThisRound] = useState(false);
  const [ultimateExpiresAt, setUltimateExpiresAt] = useState<number | null>(null);
  const [ultimateTimeLeft, setUltimateTimeLeft] = useState(15.0);

  // Overlay for round complete transition
  const [roundTransitionOverlay, setRoundTransitionOverlay] = useState<{
    round: number;
    winner: "player" | "opponent";
    playerWins: number;
    opponentWins: number;
  } | null>(null);

  // Event guards to prevent race condition double triggers
  const processedRoundsRef = useRef<Set<number>>(new Set());
  const transitionedRoundsRef = useRef<Set<number>>(new Set());
  const processedUltimateExecutionsRef = useRef<Set<string>>(new Set());
  const matchEndedRef = useRef(false);

  const [playerHp, setPlayerHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [combo, setCombo] = useState(0);
  const [meter, setMeter] = useState(0);
  const [best, setBest] = useState(0);

  const [currentMove, setCurrentMove] = useState<Move>(() => generateMove());
  const [typed, setTyped] = useState("");
  const [playerPose, setPlayerPose] = useState<FighterPose>("idle");
  const [enemyPose, setEnemyPose] = useState<FighterPose>("idle");
  const [enemyIncoming, setEnemyIncoming] = useState<MoveType | null>(null);
  const [enemyCombo, setEnemyCombo] = useState(0);
  const [enemyMeter, setEnemyMeter] = useState(0);
  const [defensePose, setDefensePose] = useState<"block" | "dodge" | null>(null);

  const [shake, setShake] = useState(0);
  const [slowmo, setSlowmo] = useState(false);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const idRef = useRef(0);
  const healthWarnRef = useRef(false);
  const [audioMuted, setAudioMuted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const inputRoomRef = useRef<HTMLInputElement>(null);
  const defensePoseRef = useRef<"block" | "dodge" | null>(null);
  const phaseRef = useRef(phase);
  const roomIdRef = useRef(roomId);
  const windupSentRef = useRef(false);
  const joinTimeoutRef = useRef<number | null>(null);

  const roundRef = useRef(round);
  const playerRoundWinsRef = useRef(playerRoundWins);
  const opponentRoundWinsRef = useRef(opponentRoundWins);
  const playerHpRef = useRef(playerHp);
  const enemyHpRef = useRef(enemyHp);
  const ultimateActiveRef = useRef(ultimateActive);
  const ultimateExecutingRef = useRef(ultimateExecuting);
  const ultimateOwnerRef = useRef(ultimateOwner);
  const ultimateProgressRef = useRef(ultimateProgress);
  const ultimateTriggeredThisRoundRef = useRef(ultimateTriggeredThisRound);
  const ultimateExpiresAtRef = useRef<number | null>(null);

  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { defensePoseRef.current = defensePose; }, [defensePose]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { playerRoundWinsRef.current = playerRoundWins; }, [playerRoundWins]);
  useEffect(() => { opponentRoundWinsRef.current = opponentRoundWins; }, [opponentRoundWins]);
  useEffect(() => { playerHpRef.current = playerHp; }, [playerHp]);
  useEffect(() => { enemyHpRef.current = enemyHp; }, [enemyHp]);
  useEffect(() => { ultimateActiveRef.current = ultimateActive; }, [ultimateActive]);
  useEffect(() => { ultimateExecutingRef.current = ultimateExecuting; }, [ultimateExecuting]);
  useEffect(() => { ultimateOwnerRef.current = ultimateOwner; }, [ultimateOwner]);
  useEffect(() => { ultimateProgressRef.current = ultimateProgress; }, [ultimateProgress]);
  useEffect(() => { ultimateTriggeredThisRoundRef.current = ultimateTriggeredThisRound; }, [ultimateTriggeredThisRound]);
  useEffect(() => { ultimateExpiresAtRef.current = ultimateExpiresAt; }, [ultimateExpiresAt]);

  const poseTimerRef = useRef<number | null>(null);
  const enemyPoseTimerRef = useRef<number | null>(null);

  // Auto focus move input ONLY during fight
  useEffect(() => {
    if (phase === "fight") {
      inputRef.current?.focus();
    }
  }, [phase, currentMove]);

  // Health-low warning beep
  useEffect(() => {
    if (phase !== "fight") return;
    if (playerHp > 0 && playerHp <= 25 && !healthWarnRef.current) {
      healthWarnRef.current = true;
      sfx.healthWarn();
    }
    if (playerHp > 25) healthWarnRef.current = false;
  }, [playerHp, phase]);

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

  const setPose = useCallback((who: Fighter, pose: FighterPose, ms = 300) => {
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

  // Reset round-specific state
  const resetRoundState = useCallback((nextRoundNumber: number) => {
    setRound(nextRoundNumber);
    setPlayerHp(100);
    setEnemyHp(100);
    setCombo(0);
    setMeter(0);
    setEnemyCombo(0);
    setEnemyMeter(0);
    setPlayerPose("idle");
    setEnemyPose("idle");
    setEnemyIncoming(null);
    setDefensePose(null);
    setTyped("");
    setCurrentMove(generateMove());
    setFloats([]);
    setSparks([]);
    setFlash(null);

    // Reset ultimate states
    setUltimateActive(false);
    setUltimateExecuting(false);
    setUltimateOwner(null);
    setUltimateProgress(0);
    setOpponentUltimateProgress(0);
    setUltimateSequence([]);
    setUltimateTriggeredThisRound(false);
    processedUltimateExecutionsRef.current.clear();
  }, []);

  // Safe round transition using a guard
  const transitionToRound = useCallback((nextRound: number) => {
    if (transitionedRoundsRef.current.has(nextRound)) return;
    transitionedRoundsRef.current.add(nextRound);

    setRoundTransitionOverlay(null);
    resetRoundState(nextRound);

    // Start countdown
    setFlash("READY?");
    sfx.countdown();
    setTimeout(() => sfx.countdown(), 400);
    setTimeout(() => sfx.countdown(), 800);
    setTimeout(() => { setFlash("FIGHT!"); sfx.roundStart(); }, 1200);
    setTimeout(() => { setFlash(null); setPhase("fight"); }, 2000);
  }, [resetRoundState]);

  // Handle round completion logic
  const handleRoundEnd = useCallback((winner: "player" | "opponent") => {
    const currentRound = roundRef.current;
    if (processedRoundsRef.current.has(currentRound)) {
      return; // Already processed this round's end
    }

    // 1. Lock gameplay input by switching phase for both Host and Guest
    setPhase("ready");

    if (isHostRef.current) {
      processedRoundsRef.current.add(currentRound);

      // Play sound effects
      if (winner === "player") {
        sfx.victory();
      } else {
        sfx.gameOver();
      }

      // Update scores
      let newPlayerWins = playerRoundWinsRef.current;
      let newOpponentWins = opponentRoundWinsRef.current;
      if (winner === "player") {
        newPlayerWins += 1;
        setPlayerRoundWins(newPlayerWins);
      } else {
        newOpponentWins += 1;
        setOpponentRoundWins(newOpponentWins);
      }

      // Check for match victory
      const matchOver = newPlayerWins >= 2 || newOpponentWins >= 2;
      let matchWinnerId: string | undefined = undefined;
      if (matchOver) {
        matchWinnerId = newPlayerWins >= 2 ? net.getId() : "opponent";
      }

      // Determine authoritative IDs
      const hostId = net.getId();
      const guestId = "opponent";
      const winnerId = winner === "player" ? hostId : guestId;
      const loserId = winner === "player" ? guestId : hostId;

      // Broadcast authoritative result
      net.emit("round:result", {
        roundId: currentRound,
        winnerId,
        loserId,
        playerRoundWins: newPlayerWins,
        opponentRoundWins: newOpponentWins,
        matchOver,
        matchWinnerId,
        roomId: roomIdRef.current
      });

      // Show transition overlay
      setRoundTransitionOverlay({
        round: currentRound,
        winner,
        playerWins: newPlayerWins,
        opponentWins: newOpponentWins,
      });

      if (matchOver) {
        matchEndedRef.current = true;
        setTimeout(() => {
          setRoundTransitionOverlay(null);
          if (newPlayerWins >= 2) {
            setPhase("victory");
          } else {
            setPhase("ko");
          }
        }, 3000);
      } else {
        // Transition to next round
        setTimeout(() => {
          const nextRound = (currentRound + 1) as 2 | 3;
          transitionToRound(nextRound);
          net.emit("round:transition", { nextRound, roomId: roomIdRef.current });
        }, 3500);
      }
    }
  }, [transitionToRound]);

  // Execute ultimate logic
  const executeUltimate = () => {
    if (ultimateExecuting) return;
    setUltimateExecuting(true);

    const damage = 30;
    const executionId = "exec_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    processedUltimateExecutionsRef.current.add(executionId);

    // Visuals/Audio locally
    setPose("player", "special", 1500);
    sfx.hitSpecial();
    triggerShake(1.2);
    setFlash("⚡ ULTIMATE EXECUTED ⚡");

    // Spawn massive sparks / particle effects on opponent
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        addSpark("right", "var(--neon-pink)");
        addFloat("CRITICAL HIT!", "right", "var(--neon-pink)", 36);
      }, i * 200);
    }

    // Apply damage and handle KO/Survival
    setTimeout(() => {
      setEnemyHp(hp => {
        const next = Math.max(0, hp - damage);
        net.emit("opponent:hp", { hp: next, roomId: roomIdRef.current });
        
        if (next <= 0) {
          // KO sequence
          setEnemyPose("ko");
          setSlowmo(true);
          setFlash("K.O.");
          sfx.koFlash();
          setTimeout(() => {
            setSlowmo(false);
            setFlash(null);
            handleRoundEnd("player");
          }, 1200);
        } else {
          // Survive: exit ultimate mode, return to normal combat
          setUltimateActive(false);
          setUltimateOwner(null);
          setUltimateExecuting(false);
          setTyped("");
          setCurrentMove(generateMove());
          setFlash(null);
        }
        return next;
      });
    }, 1000);

    // Broadcast execute
    net.emit("ultimate:execute", { 
      roundId: roundRef.current, 
      ownerId: net.getId(), 
      executionId,
      damage, 
      roomId: roomIdRef.current 
    });
  };

  // Listen to keyboard inputs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (phase !== "fight") return;

    if (ultimateActive) {
      if (ultimateOwner === "player" && !ultimateExecuting) {
        const key = e.key.toUpperCase();
        if (key.length === 1 && /^[A-Z]$/.test(key)) {
          e.preventDefault();
          const targetChar = ultimateSequence[0];
          if (key === targetChar) {
            // Correct letter!
            const nextProgress = ultimateProgress + 1;
            setUltimateProgress(nextProgress);

            net.emit("ultimate:progress", { 
              roundId: roundRef.current, 
              ownerId: net.getId(), 
              progress: nextProgress, 
              roomId: roomIdRef.current 
            });

            if (nextProgress >= 15) {
              executeUltimate();
            } else {
              sfx.typeKey();
              // Shift letters
              setUltimateSequence(prev => {
                const next = prev.slice(1);
                return [...next, getRandomLetter()];
              });
            }
          } else {
            // Incorrect letter: feedback but no HP penalty or combo resets
            sfx.typeMiss();
          }
        } else {
          e.preventDefault();
        }
      } else {
        // If opponent is executing or charging, block all keys
        e.preventDefault();
      }
      return;
    }

    const key = e.key.toUpperCase();
    if (key.length !== 1) return; // ignore control keys
  };

  // Handle typing input during fight
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (phase !== "fight") return;
    if (ultimateActive) {
      setTyped("");
      return;
    }
    const val = e.target.value.toLowerCase();
    const target = currentMove.word.toLowerCase();

    // detect wrong char
    if (!target.startsWith(val)) {
      setPose("player", "hurt", 250);
      setCombo(0);
      setPlayerHp(hp => {
        const next = Math.max(0, hp - 2);
        net.emit("opponent:hp", { hp: next, roomId: roomIdRef.current });
        return next;
      });
      addFloat("MISS", "left", "var(--hp-red)", 22);
      setTyped("");
      setCurrentMove(generateMove());
      windupSentRef.current = false;
      net.emit("opponent:miss", { roomId: roomIdRef.current });
      sfx.typeMiss();
      return;
    }

    setTyped(val);

    if (val.length > typed.length && val !== target) sfx.typeKey();

    if (val.length === 1 && !windupSentRef.current) {
      const t = currentMove.type;
      if (t === "punch" || t === "kick" || t === "aerial" || t === "special") {
        windupSentRef.current = true;
        net.emit("opponent:windup", { move: t as NetMove, roomId: roomIdRef.current });
      }
    }

    if (val === target) {
      const isSpecial = currentMove.type === "special";
      const isDefense = currentMove.type === "block" || currentMove.type === "dodge";
      if (isDefense) {
        setDefensePose(currentMove.type as "block" | "dodge");
        setPose("player", currentMove.type, 500);
        addFloat(currentMove.type.toUpperCase() + "!", "left", currentMove.color, 24);
        if (currentMove.type === "block") sfx.block(); else sfx.dodge();
      } else {
        const comboMult = 1 + combo * 0.05;
        const dmg = Math.round(currentMove.damage * comboMult);
        net.emit("opponent:attack", { move: currentMove.type as NetMove, damage: dmg, roomId: roomIdRef.current });
        setPose("player", currentMove.type, 300);
        setTimeout(() => {
          setPose("enemy", "hurt", 250);
          addSpark("right", currentMove.color);
          addFloat(`-${dmg}`, "right", "var(--neon-yellow)", isSpecial ? 44 : 30);
          if (currentMove.label !== "PUNCH") addFloat(currentMove.label, "right", currentMove.color, 22);
          triggerShake(isSpecial ? 1 : 0.6);
          if (isSpecial) {
            setSlowmo(true);
            setFlash("ULTIMATE!");
            sfx.hitSpecial();
            setTimeout(() => { setSlowmo(false); setFlash(null); }, 800);
          } else if (currentMove.type === "aerial" || currentMove.type === "kick") {
            sfx.hitHeavy();
          } else {
            sfx.hitLight();
          }
        }, 120);
      }

      const newCombo = combo + 1;
      setCombo(newCombo);
      setBest(b => Math.max(b, newCombo));
      if (newCombo > 1 && newCombo % 3 === 0) sfx.combo(newCombo);

      let nextMeter = meter;
      if (isSpecial) nextMeter = 0;
      else nextMeter = Math.min(100, meter + (isDefense ? 4 : 8) + newCombo);
      if (meter < 100 && nextMeter >= 100) sfx.meterFull();
      setMeter(nextMeter);

      setTyped("");
      const forceSpecial = nextMeter >= 100 && newCombo >= 3 && Math.random() < 0.5;
      setCurrentMove(generateMove(forceSpecial));
      windupSentRef.current = false;
    }
  };

  // Reset local state, then run the READY? / FIGHT! countdown.
  const beginCountdown = useCallback(() => {
    setRound(1);
    setPlayerRoundWins(0);
    setOpponentRoundWins(0);
    
    setUltimateActive(false);
    setUltimateExecuting(false);
    setUltimateOwner(null);
    setUltimateProgress(0);
    setOpponentUltimateProgress(0);
    setUltimateSequence([]);
    setUltimateTriggeredThisRound(false);
    processedUltimateExecutionsRef.current.clear();
    
    processedRoundsRef.current.clear();
    transitionedRoundsRef.current.clear();
    matchEndedRef.current = false;

    setPlayerHp(100); setEnemyHp(100);
    setCombo(0); setMeter(0);
    setEnemyCombo(0); setEnemyMeter(0);
    healthWarnRef.current = false;
    setPlayerPose("idle"); setEnemyPose("idle");
    setEnemyIncoming(null); setDefensePose(null);
    setCurrentMove(generateMove());
    setTyped("");
    setPhase("ready");
    setFlash("READY?");
    sfx.countdown();
    setTimeout(() => sfx.countdown(), 400);
    setTimeout(() => sfx.countdown(), 800);
    setTimeout(() => { setFlash("FIGHT!"); sfx.roundStart(); }, 1200);
    setTimeout(() => { setFlash(null); setPhase("fight"); }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Multiplayer socket event listeners ----
  useEffect(() => {
    // Host receives join request from another player
    const offJoinReq = net.on("room:join_request", ({ roomId: reqRoomId, senderId }) => {
      const currentRoomId = roomIdRef.current;
      const currentPhase = phaseRef.current;
      if (!currentRoomId || !reqRoomId) return;
      if (reqRoomId.trim().toUpperCase() !== currentRoomId.trim().toUpperCase()) return;

      if (currentPhase === "hosting") {
        // Room has space — accept joiner & start match
        net.emit("room:accept", {
          roomId: currentRoomId,
          hostId: net.getId(),
          targetId: senderId,
        });
        beginCountdown();
      } else if (currentPhase === "ready" || currentPhase === "fight") {
        // Room is already full (strictly 1v1)
        net.emit("room:full", {
          roomId: currentRoomId,
          targetId: senderId,
        });
      }
    });

    // Joiner receives acceptance from host
    const offAccept = net.on("room:accept", ({ roomId: acceptedRoomId, targetId }) => {
      const myId = net.getId();
      if (targetId && myId && targetId !== myId) return;

      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      setIsJoining(false);
      setRoomId(acceptedRoomId);
      roomIdRef.current = acceptedRoomId;
      setRoomError(null);
      beginCountdown();
    });

    // Joiner receives room full error from host
    const offFull = net.on("room:full", ({ targetId }) => {
      const myId = net.getId();
      if (targetId && myId && targetId !== myId) return;

      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      setIsJoining(false);
      setRoomError("Room is full. Maximum 2 players allowed.");
      setPhase("lobby");
    });

    // In-game events (filtered by roomId)
    const offWindup = net.on("opponent:windup", ({ move, roomId: eventRoomId }) => {
      if (phaseRef.current !== "fight") return;
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      setEnemyIncoming(move);
    });

    const offAttack = net.on("opponent:attack", ({ move, damage, roomId: eventRoomId }) => {
      if (phaseRef.current !== "fight") return;
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      setPose("enemy", move, 350);
      const guard = defensePoseRef.current;
      let dmg = damage;
      if (guard === "block") dmg = damage * 0.15;
      else if (guard === "dodge") dmg = 0;
      window.setTimeout(() => {
        addSpark("left", guard === "block" ? "var(--neon-cyan)" : "var(--neon-yellow)");
        if (dmg > 0) {
          setPlayerHp(hp => {
            const next = Math.max(0, hp - Math.round(dmg));
            net.emit("opponent:hp", { hp: next, roomId: roomIdRef.current });
            return next;
          });
          setPose("player", "hurt", 300);
          addFloat(`-${Math.round(dmg)}`, "left", "var(--hp-red)", 28);
          triggerShake(1);
          setCombo(0);
          sfx.hitHeavy();
        } else if (guard === "dodge") {
          addFloat("DODGE!", "left", "var(--neon-purple)", 28);
          sfx.dodge();
        } else if (guard === "block") {
          addFloat("BLOCK!", "left", "var(--neon-cyan)", 26);
          sfx.block();
        }
        setEnemyIncoming(null);
        setDefensePose(null);
      }, 180);
    });

    const offHp = net.on("opponent:hp", ({ hp, roomId: eventRoomId }) => {
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      setEnemyHp(hp);
    });

    const offStats = net.on("opponent:stats", ({ combo: c, meter: m, roomId: eventRoomId }) => {
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      setEnemyCombo(c);
      setEnemyMeter(m);
    });

    const offMiss = net.on("opponent:miss", (payload) => {
      if (payload?.roomId && roomIdRef.current && payload.roomId !== roomIdRef.current) return;
      setPose("enemy", "hurt", 180);
    });

    const offDisc = net.on("opponent:disconnect", (payload) => {
      if (payload?.roomId && roomIdRef.current && payload.roomId !== roomIdRef.current) return;
      if (phaseRef.current === "fight" || phaseRef.current === "hosting" || phaseRef.current === "ready") {
        setFlash("OPPONENT LEFT");
        window.setTimeout(() => {
          setFlash(null);
          backToMenu();
        }, 1500);
      }
    });

    const offRoundResult = net.on("round:result", ({ roundId, winnerId, loserId, playerRoundWins: hostPlayerWins, opponentRoundWins: hostOpponentWins, matchOver, matchWinnerId, roomId: eventRoomId }) => {
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      
      const currentRound = roundRef.current;
      if (roundId !== currentRound) return;
      if (processedRoundsRef.current.has(roundId)) return;
      processedRoundsRef.current.add(roundId);

      // Lock gameplay input
      setPhase("ready");

      const myId = net.getId();
      const didIWin = winnerId === myId;
      const roundWinnerLabel = didIWin ? "player" : "opponent";

      // Play sound effects
      if (didIWin) {
        sfx.victory();
      } else {
        sfx.gameOver();
      }

      // Update scores authoritatively
      if (isHostRef.current) {
        setPlayerRoundWins(hostPlayerWins);
        setOpponentRoundWins(hostOpponentWins);
      } else {
        setPlayerRoundWins(hostOpponentWins);
        setOpponentRoundWins(hostPlayerWins);
      }

      const finalPlayerWins = isHostRef.current ? hostPlayerWins : hostOpponentWins;
      const finalOpponentWins = isHostRef.current ? hostOpponentWins : hostPlayerWins;

      // Show transition overlay
      setRoundTransitionOverlay({
        round: roundId,
        winner: roundWinnerLabel,
        playerWins: finalPlayerWins,
        opponentWins: finalOpponentWins,
      });

      if (matchOver) {
        matchEndedRef.current = true;
        setTimeout(() => {
          setRoundTransitionOverlay(null);
          const amIMatchWinner = matchWinnerId === myId;
          if (amIMatchWinner) {
            setPhase("victory");
          } else {
            setPhase("ko");
          }
        }, 3000);
      }
    });

    const offRoundTransition = net.on("round:transition", ({ nextRound, roomId: eventRoomId }) => {
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      transitionToRound(nextRound);
    });

    const offUltimateActivate = net.on("ultimate:activate", ({ roundId, ownerId, startedAt, expiresAt, timestamp, roomId: eventRoomId }) => {
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      if (roundId !== roundRef.current) return;

      const myId = net.getId();
      const isOpponent = ownerId !== myId;

      if (ultimateActiveRef.current) {
        if (ultimateOwnerRef.current === "player" && isOpponent) {
          const myTimestamp = Date.now();
          const incomingWins = (timestamp < myTimestamp) || (timestamp === myTimestamp && ownerId < myId);
          if (incomingWins) {
            triggerUltimateComeback("opponent", true, startedAt, expiresAt);
          }
        }
        return;
      }

      if (isOpponent) {
        triggerUltimateComeback("opponent", true, startedAt, expiresAt);
      } else {
        triggerUltimateComeback("player", true, startedAt, expiresAt);
      }
    });

    const offUltimateProgress = net.on("ultimate:progress", ({ roundId, ownerId, progress, roomId: eventRoomId }) => {
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      if (roundId !== roundRef.current) return;
      if (ownerId !== net.getId()) {
        setOpponentUltimateProgress(progress);
      }
    });

    const offUltimateExecute = net.on("ultimate:execute", ({ roundId, ownerId, executionId, damage, roomId: eventRoomId }) => {
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      if (roundId !== roundRef.current) return;
      if (processedUltimateExecutionsRef.current.has(executionId)) return;
      processedUltimateExecutionsRef.current.add(executionId);

      setUltimateExecuting(true);
      setPose("enemy", "special", 1500);
      sfx.hitSpecial();
      triggerShake(1.2);
      setFlash("⚡ OPPONENT ULTIMATE! ⚡");

      // Spawn massive particles / sparks on player side
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          addSpark("left", "var(--neon-cyan)");
          addFloat("CRITICAL HIT!", "left", "var(--hp-red)", 36);
        }, i * 200);
      }

      // Apply damage after the animation ends
      setTimeout(() => {
        setPlayerHp(hp => {
          const next = Math.max(0, hp - damage);
          net.emit("opponent:hp", { hp: next, roomId: roomIdRef.current });

          if (next <= 0) {
            // KO sequence
            setPlayerPose("ko");
            setSlowmo(true);
            setFlash("DEFEAT");
            sfx.koFlash();
            setTimeout(() => {
              setSlowmo(false);
              setFlash(null);
              handleRoundEnd("opponent");
            }, 1200);
          } else {
            // Survived: exit ultimate mode, return to normal combat
            setUltimateActive(false);
            setUltimateOwner(null);
            setUltimateExecuting(false);
            setTyped("");
            setCurrentMove(generateMove());
            setFlash(null);
          }

          return next;
        });
      }, 1000);
    });

    const offUltimateExpire = net.on("ultimate:expire", ({ roundId, ownerId, roomId: eventRoomId }) => {
      if (eventRoomId && roomIdRef.current && eventRoomId !== roomIdRef.current) return;
      if (roundId !== roundRef.current) return;
      
      const myId = net.getId();
      if (ownerId !== myId) {
        setUltimateActive(false);
        setUltimateOwner(null);
        setTyped("");
        setCurrentMove(generateMove());
      }
    });

    return () => {
      offJoinReq();
      offAccept();
      offFull();
      offWindup();
      offAttack();
      offHp();
      offStats();
      offMiss();
      offDisc();
      offRoundResult();
      offRoundTransition();
      offUltimateActivate();
      offUltimateProgress();
      offUltimateExecute();
      offUltimateExpire();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Broadcast own combo/meter so opponent's HUD stays in sync.
  useEffect(() => {
    if (phase !== "fight") return;
    net.emit("opponent:stats", { combo, meter, roomId: roomIdRef.current });
  }, [combo, meter, phase]);

  const triggerUltimateComeback = useCallback((owner: "player" | "opponent", fromNetwork = false, startedAt?: number, expiresAt?: number) => {
    ultimateActiveRef.current = true;
    ultimateOwnerRef.current = owner;
    ultimateTriggeredThisRoundRef.current = true;

    setUltimateActive(true);
    setUltimateOwner(owner);
    setUltimateProgress(0);
    setOpponentUltimateProgress(0);
    setUltimateTriggeredThisRound(true);
    setUltimateSequence(generateUltimateSequence());

    const now = Date.now();
    const finalStartedAt = startedAt || now;
    const finalExpiresAt = expiresAt || (finalStartedAt + 15000);

    setUltimateExpiresAt(finalExpiresAt);
    ultimateExpiresAtRef.current = finalExpiresAt;
    setUltimateTimeLeft(15.0);

    if (owner === "player") {
      setPose("player", "special", 5000);
      if (!fromNetwork) {
        net.emit("ultimate:activate", { 
          roundId: roundRef.current, 
          ownerId: net.getId(), 
          startedAt: finalStartedAt,
          expiresAt: finalExpiresAt,
          timestamp: now,
          roomId: roomIdRef.current
        });
      }
    } else {
      setPose("enemy", "special", 5000);
    }
    sfx.meterFull();
  }, [setPose]);

  // Monitor HP to trigger Ultimate Comeback (Round 2 only)
  useEffect(() => {
    if (phase !== "fight") return;
    if (round !== 2) return;
    if (ultimateActive || ultimateExecuting || ultimateTriggeredThisRound) return;

    if (playerHp <= 30 && playerHp > 0) {
      triggerUltimateComeback("player");
    } else if (enemyHp <= 30 && enemyHp > 0) {
      triggerUltimateComeback("opponent");
    }
  }, [playerHp, enemyHp, phase, round, ultimateActive, ultimateExecuting, ultimateTriggeredThisRound, triggerUltimateComeback]);

  // Ultimate countdown timer interval
  useEffect(() => {
    if (!ultimateActive || !ultimateExpiresAt) {
      setUltimateTimeLeft(15.0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, (ultimateExpiresAt - Date.now()) / 1000);
      setUltimateTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        
        // Expiration logic
        if (ultimateOwner === "player" && !ultimateExecuting) {
          net.emit("ultimate:expire", {
            roundId: roundRef.current,
            ownerId: net.getId(),
            roomId: roomIdRef.current
          });
          
          setUltimateActive(false);
          setUltimateOwner(null);
          setTyped("");
          setCurrentMove(generateMove());
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [ultimateActive, ultimateExpiresAt, ultimateOwner, ultimateExecuting]);

  // KO detection
  useEffect(() => {
    if (phase !== "fight") return;
    if (ultimateExecuting) return;
    if (enemyHp <= 0) {
      setEnemyPose("ko");
      setSlowmo(true);
      setFlash("K.O.");
      triggerShake(1);
      sfx.koFlash();
      const t = setTimeout(() => {
        setSlowmo(false);
        setFlash(null);
        handleRoundEnd("player");
      }, 1200);
      return () => clearTimeout(t);
    } else if (playerHp <= 0) {
      setPlayerPose("ko");
      setSlowmo(true);
      setFlash("DEFEAT");
      triggerShake(1);
      sfx.koFlash();
      const t = setTimeout(() => {
        setSlowmo(false);
        setFlash(null);
        handleRoundEnd("opponent");
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [enemyHp, playerHp, phase, triggerShake, handleRoundEnd]);


  const handleCreateRoom = () => {
    unlockAudio();
    sfx.select();
    net.connect();
    const id = generateRoomId();
    setRoomId(id);
    roomIdRef.current = id;
    setRoomError(null);
    setIsJoining(false);
    setIsHost(true);
    net.createRoomPeer(id);
    setPhase("hosting");
  };

  const handleJoinRoom = () => {
    const id = joinInput.trim().toUpperCase();
    if (!id || id.length < 4) {
      setRoomError("Please enter a valid Room ID.");
      return;
    }
    unlockAudio();
    sfx.select();
    setRoomError(null);
    setIsJoining(true);

    net.subscribeRoom(id);
    net.connect();
    const myId = net.getId() || Math.random().toString(36).substring(2);

    setIsHost(false);
    net.joinRoomPeer(id, (success) => {
      if (success) {
        net.emit("room:join_request", { roomId: id, senderId: myId });
      }
    });

    net.emit("room:join_request", { roomId: id, senderId: myId });

    const retryTimer = window.setTimeout(() => {
      if (phaseRef.current === "lobby") {
        net.emit("room:join_request", { roomId: id, senderId: myId });
      }
    }, 600);

    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = window.setTimeout(() => {
      clearTimeout(retryTimer);
      setIsJoining(false);
      setRoomError("Room not found. Check the Room ID and try again.");
    }, 4000);
  };

  const openLobby = () => {
    unlockAudio();
    sfx.select();
    setJoinInput("");
    setRoomError(null);
    setIsJoining(false);
    setPhase("lobby");
    setTimeout(() => inputRoomRef.current?.focus(), 50);
  };

  const backToMenu = () => {
    sfx.back();
    if (roomIdRef.current) {
      net.emit("opponent:disconnect", { roomId: roomIdRef.current });
    }
    net.disconnect();
    setRoomId("");
    roomIdRef.current = "";
    setJoinInput("");
    setRoomError(null);
    setIsJoining(false);
    setIsHost(false);
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    
    // Reset match states
    setRound(1);
    setPlayerRoundWins(0);
    setOpponentRoundWins(0);
    processedRoundsRef.current.clear();
    transitionedRoundsRef.current.clear();
    matchEndedRef.current = false;
    
    setPhase("menu");
  };

  const toggleMute = () => {
    unlockAudio();
    const next = !audioMuted;
    setAudioMuted(next);
    setMuted(next);
    if (!next) sfx.select();
  };

  const rematch = () => {
    setRound(1);
    setPlayerRoundWins(0);
    setOpponentRoundWins(0);
    processedRoundsRef.current.clear();
    transitionedRoundsRef.current.clear();
    processedUltimateExecutionsRef.current.clear();
    matchEndedRef.current = false;

    setUltimateActive(false);
    setUltimateExecuting(false);
    setUltimateOwner(null);
    setUltimateProgress(0);
    setOpponentUltimateProgress(0);
    setUltimateSequence([]);
    setUltimateTriggeredThisRound(false);

    setIsHost(false);
    openLobby();
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
      onClick={() => {
        if (phase === "fight") {
          inputRef.current?.focus();
        }
      }}
    >
      <ArenaBackdrop />

      {/* Top HUD */}
      <header className="relative z-20 px-8 pt-5 max-w-7xl mx-auto w-full">
        <button
          onClick={toggleMute}
          className="absolute right-8 top-5 z-30 text-[10px] tracking-[0.3em] border px-2 py-1 hover:opacity-100 opacity-70 cursor-pointer"
          style={{ borderColor: "var(--neon-cyan)", color: "var(--neon-cyan)", background: "rgba(0,0,0,0.6)" }}
          aria-label={audioMuted ? "Unmute" : "Mute"}
        >{audioMuted ? "SOUND OFF" : "SOUND ON"}</button>
        <div className="flex items-center justify-between gap-8">
          <HealthBar
            hp={playerHp}
            max={100}
            label="YOU"
            side="left"
            combo={combo}
            meter={meter}
          />
          <div className="flex flex-col items-center px-4 shrink-0">
            <div className="text-xs font-bold tracking-[0.25em]" style={{ color: "var(--neon-yellow)" }}>ROUND {round}</div>
            <div className="text-4xl md:text-5xl font-black mt-0.5 tracking-widest" style={{ color: "var(--neon-yellow)", textShadow: "0 0 14px rgba(255, 204, 0, 0.6)" }}>
              {playerRoundWins} - {opponentRoundWins}
            </div>
            <div className="text-[10px] tracking-[0.2em] opacity-60 mt-0.5">BEST OF 3</div>
          </div>
          <HealthBar
            hp={enemyHp}
            max={100}
            label="OPPONENT"
            side="right"
            combo={enemyCombo}
            meter={enemyMeter}
          />
        </div>
      </header>

      {/* Stage */}
      <section className="relative z-10 mx-auto mt-10 flex h-[46vh] max-w-6xl items-end justify-between px-16">
        {/* Player */}
        <div className="relative">
          <FighterSprite side="left" pose={playerPose} hurt={playerPose === "hurt"} color="oklch(0.35 0.2 260)" accent="var(--neon-cyan)" />
        </div>

        {/* Center Ultimate Panel */}
        {ultimateActive && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-30 pointer-events-none">
            <div className="px-10 py-8 border-4 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-scale-up"
                 style={{
                   borderColor: ultimateOwner === "player" ? "var(--neon-yellow)" : "var(--neon-pink)",
                   boxShadow: `0 0 40px ${ultimateOwner === "player" ? "var(--neon-yellow)" : "var(--neon-pink)"}`,
                   pointerEvents: "auto"
                 }}>
              <div className="text-2xl md:text-3xl font-black tracking-[0.4em] mb-4 text-center animate-pulse"
                   style={{
                     color: ultimateOwner === "player" ? "var(--neon-yellow)" : "var(--neon-pink)",
                     textShadow: `0 0 12px ${ultimateOwner === "player" ? "var(--neon-yellow)" : "var(--neon-pink)"}`
                   }}>
                ⚡ ULTIMATE COMEBACK ⚡
              </div>
              
              {ultimateOwner === "player" ? (
                <>
                  <div className="flex gap-4 my-6">
                    {ultimateSequence.slice(0, 5).map((char, index) => (
                      <span
                        key={index}
                        className={`px-5 py-3 border-2 text-2xl font-black tracking-normal transition-all duration-200 ${
                          index === 0
                            ? "bg-[var(--neon-yellow)] text-black border-[var(--neon-yellow)] scale-125"
                            : "border-white/20 text-white/50"
                        }`}
                        style={index === 0 ? {
                          boxShadow: "0 0 20px var(--neon-yellow)",
                        } : undefined}
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm tracking-[0.2em] text-white/80 font-bold mb-2">
                    TYPE THE SEQUENCE
                  </div>
                  <div className="text-xl font-black text-[var(--neon-yellow)]" style={{ textShadow: "0 0 8px var(--neon-yellow)" }}>
                    {ultimateProgress} / 15
                  </div>
                  <div className="text-lg font-black mt-2 text-white animate-pulse">
                    {ultimateTimeLeft.toFixed(1)}s
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg tracking-[0.2em] text-white/90 font-bold my-4 text-center">
                    OPPONENT IS CHARGING...
                  </div>
                  <div className="text-2xl font-black text-[var(--neon-pink)]" style={{ textShadow: "0 0 8px var(--neon-pink)" }}>
                    {opponentUltimateProgress} / 15
                  </div>
                  <div className="text-lg font-black mt-2 text-white animate-pulse">
                    {ultimateTimeLeft.toFixed(1)}s
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Enemy */}
        <div className="relative">
          {enemyIncoming && !ultimateActive && (
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
        {ultimateActive ? (
          <div className="mx-auto max-w-4xl border-2 p-6 text-center" 
               style={{ 
                 borderColor: ultimateOwner === "player" ? "var(--neon-yellow)" : "var(--neon-pink)", 
                 background: "rgba(0,0,0,0.85)", 
                 boxShadow: `0 0 32px ${ultimateOwner === "player" ? "var(--neon-yellow)" : "var(--neon-pink)"}` 
               }}>
            {ultimateOwner === "player" ? (
              <>
                <div className="text-sm font-black tracking-[0.3em] text-[var(--neon-yellow)] animate-pulse">
                  ⚡ ULTIMATE COMEBACK ACTIVE ⚡
                </div>
                <div className="text-xs opacity-75 mt-1 tracking-widest">
                  TYPE THE CENTER KEYSTREAM TO UNLEASH YOUR ULTIMATE ATTACK!
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-black tracking-[0.3em] text-[var(--neon-pink)] animate-pulse">
                  ⚠️ OPPONENT ULTIMATE ACTIVE ⚠️
                </div>
                <div className="text-xs opacity-75 mt-1 tracking-widest">
                  BRACE YOURSELF! OPPONENT IS TYPING THEIR ULTIMATE COMEBACK!
                </div>
              </>
            )}
            <input
              ref={inputRef}
              value=""
              onChange={onChange}
              onKeyDown={handleKeyDown}
              autoFocus
              aria-label="Type the ultimate move"
              className="sr-only"
            />
          </div>
        ) : (
          <div
            className="mx-auto max-w-4xl border-2 px-6 py-4"
            style={{
              borderColor: "var(--neon-pink)",
              background: "rgba(8, 6, 18, 0.93)",
              boxShadow: "0 0 24px rgba(224, 36, 195, 0.35)",
            }}
          >
            <div className="flex items-center justify-between text-xs tracking-[0.25em] font-mono">
              <span className="font-bold text-sm flex items-center gap-1.5" style={{ color: "var(--neon-pink)", textShadow: "0 0 8px var(--neon-pink)" }}>
                <span className="text-[10px]">▶</span> {currentMove.label}
              </span>
              <span className="text-white/80">
                DMG {currentMove.damage} · COMBO x{combo} · BEST {best}
              </span>
            </div>
            <div className="mt-3 my-2 flex items-center justify-start gap-4 text-4xl md:text-5xl font-black tracking-[0.35em] text-white">
              {currentMove.word.split("").map((ch, i) => {
                const done = i < typed.length;
                const current = i === typed.length;
                return (
                  <span
                    key={i}
                    style={{
                      color: done ? "var(--neon-pink)" : current ? "#ffffff" : "rgba(255,255,255,0.9)",
                      textShadow: done ? "0 0 14px var(--neon-pink)" : current ? "0 0 10px #ffffff" : undefined,
                    }}
                  >
                    {ch.toUpperCase()}
                  </span>
                );
              })}
            </div>
            {/* Dashed track progress line */}
            <div className="relative mt-4 w-full h-[3px] overflow-hidden" style={{ background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0px, rgba(255,255,255,0.2) 8px, transparent 8px, transparent 14px)" }}>
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${progress}%`,
                  background: "var(--neon-pink)",
                  boxShadow: "0 0 10px var(--neon-pink)",
                }}
              />
            </div>
            <input
              ref={inputRef}
              value={typed}
              onChange={onChange}
              onKeyDown={handleKeyDown}
              autoFocus
              aria-label="Type the move"
              className="sr-only"
            />
          </div>
        )}
        <p className="text-center text-xs opacity-90 mt-4 tracking-widest font-mono">
          {ultimateActive ? (
            "TYPING COMBAT FROZEN · COMPLETE THE KEYSTREAM"
          ) : (
            <>
              TYPE THE WORD TO <span style={{ color: "var(--neon-yellow)", fontWeight: "bold" }}>ATTACK</span>
              <span className="opacity-50"> · </span>
              <span style={{ color: "var(--neon-cyan)", fontWeight: "bold" }}>BLOCK/DODGE</span> WHEN OPPONENT WINDS UP
            </>
          )}
        </p>
      </footer>

      {/* Round transition overlay */}
      {roundTransitionOverlay && (
        <Overlay>
          <div className="text-2xl font-bold tracking-[0.4em] text-muted-foreground animate-pulse">
            ROUND {roundTransitionOverlay.round} COMPLETE
          </div>
          <div
            className="text-5xl md:text-6xl font-black tracking-widest mt-6 text-center leading-tight uppercase"
            style={{
              color: roundTransitionOverlay.winner === "player" ? "var(--neon-cyan)" : "var(--neon-pink)",
              textShadow: `0 0 20px ${roundTransitionOverlay.winner === "player" ? "var(--neon-cyan)" : "var(--neon-pink)"}`,
            }}
          >
            {roundTransitionOverlay.winner === "player" ? "YOU WIN THE ROUND!" : "OPPONENT WINS ROUND!"}
          </div>
          <div className="text-3xl font-black mt-10 tracking-[0.3em] text-white">
            SCORE: <span style={{ color: "var(--neon-cyan)", textShadow: "0 0 8px var(--neon-cyan)" }}>{roundTransitionOverlay.playerWins}</span> — <span style={{ color: "var(--neon-pink)", textShadow: "0 0 8px var(--neon-pink)" }}>{roundTransitionOverlay.opponentWins}</span>
          </div>
          <div className="text-xs tracking-[0.2em] opacity-50 mt-12 animate-pulse">
            PREPARING NEXT ROUND...
          </div>
        </Overlay>
      )}

      {/* Menu / overlays */}
      {phase === "menu" && (
        <Overlay>
          <Title />
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="text-xs tracking-[0.4em] opacity-70">1 v 1 ONLINE</div>
            <button
              id="btn-play-online"
              onClick={openLobby}
              onMouseEnter={() => sfx.cursor()}
              className="px-8 py-3 border-2 font-black tracking-widest hover:scale-105 transition-transform cursor-pointer"
              style={{
                borderColor: "var(--neon-pink)",
                color: "var(--neon-pink)",
                background: "rgba(0,0,0,0.6)",
                boxShadow: "0 0 20px var(--neon-pink)",
              }}
            >
              PLAY ONLINE
            </button>
            <p className="mt-6 max-w-md text-center text-sm opacity-70 leading-relaxed">
              Every keystroke is a strike. Type <span style={{ color: "var(--neon-cyan)" }}>attack words</span> to unleash punches, kicks and aerials. Type <span style={{ color: "var(--neon-purple)" }}>BLOCK</span> or <span style={{ color: "var(--neon-purple)" }}>DODGE</span> to counter your opponent's incoming attacks. Chain hits for ultimates.
            </p>
          </div>
        </Overlay>
      )}

      {/* Lobby: Create or Join a room */}
      {phase === "lobby" && (
        <Overlay>
          <Title />
          <div className="mt-8 flex flex-col items-center gap-6 w-full max-w-sm px-4">
            {/* Create Room */}
            <div className="w-full flex flex-col items-center gap-2">
              <button
                id="btn-create-room"
                onClick={handleCreateRoom}
                onMouseEnter={() => sfx.cursor()}
                className="w-full px-8 py-3 border-2 font-black tracking-widest hover:scale-105 transition-transform cursor-pointer"
                style={{
                  borderColor: "var(--neon-pink)",
                  color: "var(--neon-pink)",
                  background: "rgba(0,0,0,0.6)",
                  boxShadow: "0 0 20px var(--neon-pink)",
                }}
              >
                CREATE ROOM
              </button>
            </div>

            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.15)" }} />
              <span className="text-xs tracking-[0.3em] opacity-50">OR</span>
              <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.15)" }} />
            </div>

            {/* Join Room */}
            <div className="w-full flex flex-col items-center gap-3">
              <div className="text-xs tracking-[0.4em] opacity-70">JOIN A ROOM</div>
              <input
                id="input-room-id"
                ref={inputRoomRef}
                type="text"
                value={joinInput}
                onChange={e => { setJoinInput(e.target.value.toUpperCase().slice(0, 8)); setRoomError(null); }}
                onKeyDown={e => e.key === "Enter" && !isJoining && handleJoinRoom()}
                onClick={e => e.stopPropagation()}
                placeholder="ENTER ROOM ID"
                maxLength={8}
                className="w-full text-center py-3 px-4 border-2 font-black tracking-[0.3em] text-xl bg-transparent outline-none focus:ring-2 focus:ring-cyan-400 cursor-text"
                style={{
                  borderColor: roomError ? "var(--hp-red)" : "var(--neon-cyan)",
                  color: "var(--neon-cyan)",
                  boxShadow: roomError ? "0 0 16px var(--hp-red)" : "0 0 12px var(--neon-cyan)",
                  caretColor: "var(--neon-cyan)",
                }}
                autoComplete="off"
                spellCheck={false}
                disabled={isJoining}
                autoFocus
              />
              {roomError && (
                <div
                  className="text-xs tracking-widest text-center px-3 py-2 border"
                  style={{ borderColor: "var(--hp-red)", color: "var(--hp-red)", background: "rgba(255,0,0,0.1)" }}
                >
                  {roomError}
                </div>
              )}
              <button
                id="btn-join-room"
                onClick={(e) => { e.stopPropagation(); handleJoinRoom(); }}
                onMouseEnter={() => sfx.cursor()}
                disabled={!joinInput.trim() || isJoining}
                className="w-full px-8 py-3 border-2 font-black tracking-widest hover:scale-105 transition-transform disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                style={{
                  borderColor: "var(--neon-cyan)",
                  color: "var(--neon-cyan)",
                  background: "rgba(0,0,0,0.6)",
                  boxShadow: "0 0 16px var(--neon-cyan)",
                }}
              >
                {isJoining ? "CONNECTING..." : "JOIN ROOM"}
              </button>
            </div>

            <button id="btn-lobby-back" onClick={backToMenu} className="mt-2 text-xs opacity-60 tracking-widest hover:opacity-100 cursor-pointer">
              ← BACK
            </button>
          </div>
        </Overlay>
      )}

      {/* Hosting: waiting for second player */}
      {phase === "hosting" && (
        <Overlay>
          <Title />
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="text-xs tracking-[0.4em] opacity-70">YOUR ROOM ID</div>
            <div
              className="px-8 py-4 border-2 font-black tracking-[0.5em] text-4xl select-all"
              style={{
                borderColor: "var(--neon-cyan)",
                color: "var(--neon-cyan)",
                background: "rgba(0,0,0,0.7)",
                boxShadow: "0 0 32px var(--neon-cyan), inset 0 0 16px rgba(0,255,255,0.06)",
                textShadow: "0 0 16px var(--neon-cyan)",
                letterSpacing: "0.35em",
              }}
            >
              {roomId}
            </div>
            <div className="text-xs tracking-widest opacity-60 text-center max-w-xs">
              Share this code with your opponent.<br />The game starts as soon as they join.
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: "var(--neon-pink)",
                      animationDelay: `${i * 0.25}s`,
                      boxShadow: "0 0 8px var(--neon-pink)",
                    }}
                  />
                ))}
              </div>
              <span className="text-sm tracking-[0.3em]" style={{ color: "var(--neon-pink)" }}>WAITING FOR OPPONENT</span>
            </div>
            <button id="btn-hosting-cancel" onClick={backToMenu} className="mt-4 text-xs opacity-60 tracking-widest hover:opacity-100 cursor-pointer">
              CANCEL
            </button>
          </div>
        </Overlay>
      )}

      {phase === "victory" && (
        <Overlay>
          <div className="text-6xl font-black tracking-widest mb-2 animate-neon" style={{ color: "var(--neon-yellow)", textShadow: "0 0 20px currentColor" }}>VICTORY</div>
          <div className="text-xl font-bold mb-4" style={{ color: "var(--neon-cyan)" }}>
            FINAL SCORE: {playerRoundWins} — {opponentRoundWins}
          </div>
          <div className="text-sm tracking-widest opacity-80">BEST COMBO · {best}</div>
          <button onClick={() => { sfx.select(); rematch(); }} onMouseEnter={() => sfx.cursor()} className="mt-8 px-8 py-3 border-2 font-black tracking-widest hover:scale-105 transition-transform cursor-pointer" style={{ borderColor: "var(--neon-pink)", color: "var(--neon-pink)", background: "rgba(0,0,0,0.6)", boxShadow: "0 0 20px var(--neon-pink)" }}>REMATCH</button>
          <button onClick={backToMenu} className="mt-3 text-xs opacity-70 tracking-widest hover:opacity-100 cursor-pointer">LEAVE MATCH</button>
        </Overlay>
      )}

      {phase === "ko" && (
        <Overlay>
          <div className="text-6xl font-black tracking-widest mb-2" style={{ color: "var(--hp-red)", textShadow: "0 0 20px currentColor" }}>YOU LOSE</div>
          <div className="text-xl font-bold mb-4" style={{ color: "var(--neon-pink)" }}>
            FINAL SCORE: {playerRoundWins} — {opponentRoundWins}
          </div>
          <div className="text-sm tracking-widest opacity-80">BEST COMBO · {best}</div>
          <button onClick={() => { sfx.select(); rematch(); }} onMouseEnter={() => sfx.cursor()} className="mt-8 px-8 py-3 border-2 font-black tracking-widest hover:scale-105 transition-transform cursor-pointer" style={{ borderColor: "var(--neon-cyan)", color: "var(--neon-cyan)", background: "rgba(0,0,0,0.6)", boxShadow: "0 0 20px var(--neon-cyan)" }}>TRY AGAIN</button>
          <button onClick={backToMenu} className="mt-3 text-xs opacity-70 tracking-widest hover:opacity-100 cursor-pointer">LEAVE MATCH</button>
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
      <div className="mt-2 text-sm tracking-[0.4em]" style={{ color: "var(--neon-cyan)" }}>TYPING FIGHTER · 1 v 1 ONLINE</div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

// Cyberpunk street alley arena background using custom image
function ArenaBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* User background image */}
      <img
        src="assets/background.jpg"
        alt="Arena Background"
        className="absolute inset-0 w-full h-full object-cover object-center retro-sprite"
      />



      {/* Atmospheric lighting gradient overlay to maintain UI contrast & game atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, rgba(8, 4, 18, 0.4) 0%, rgba(5, 5, 12, 0.15) 50%, rgba(8, 4, 20, 0.7) 100%)",
        }}
      />
      {/* Subtle CRT scanline effect overlay */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.5) 50%)",
          backgroundSize: "100% 4px",
        }}
      />
      {/* Vignette border */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </div>
  );
}