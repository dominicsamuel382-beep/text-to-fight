import React, { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/chiptune";

interface UltimateCinematicProps {
  attackerSide: "left" | "right";
  onExecuteImpact: () => void;
  onComplete: () => void;
  onCameraShake: (intensity: number) => void;
}

export function UltimateCinematic({
  attackerSide,
  onExecuteImpact,
  onComplete,
  onCameraShake,
}: UltimateCinematicProps) {
  // Phase sequence: 'freeze' -> 'slash' -> 'charge' -> 'pause' -> 'beam' -> 'impact' -> 'dissipate'
  const [phase, setPhase] = useState<
    "freeze" | "slash" | "charge" | "pause" | "beam" | "impact" | "dissipate"
  >("freeze");

  // Color cycle index for charging state
  const [colorState, setColorState] = useState(0);

  // Sparks and rock debris particles
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; vx: number; vy: number; color: string; size: number }[]
  >([]);

  const onImpactRef = useRef(onExecuteImpact);
  const onCompleteRef = useRef(onComplete);
  const onShakeRef = useRef(onCameraShake);

  useEffect(() => {
    onImpactRef.current = onExecuteImpact;
    onCompleteRef.current = onComplete;
    onShakeRef.current = onCameraShake;
  });

  useEffect(() => {
    // Play initial deep bass hit
    sfx.hitSpecial();
    onShakeRef.current(0.8);

    // Timeline steps:
    // 0ms: Freeze & Color Drain
    // 250ms: ULTIMATE Slash Tear
    // 850ms: Charge Up & Palette Cycle
    // 2200ms: Stillness / Silence Pause
    // 2400ms: Beam Eruption & Screen Flash
    // 3200ms: Impact & Multi-frame Explosion
    // 4000ms: Dissipate & Complete
    const t1 = setTimeout(() => setPhase("slash"), 250);
    const t2 = setTimeout(() => setPhase("charge"), 850);
    const t3 = setTimeout(() => setPhase("pause"), 2200);
    const t4 = setTimeout(() => {
      setPhase("beam");
      sfx.hitHeavy();
      onShakeRef.current(2.5);
    }, 2400);
    const t5 = setTimeout(() => {
      setPhase("impact");
      onImpactRef.current();
      sfx.hitSpecial();
      onShakeRef.current(3.0);
    }, 3200);
    const t6 = setTimeout(() => setPhase("dissipate"), 4000);
    const t7 = setTimeout(() => onCompleteRef.current(), 4600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(t7);
    };
  }, []);

  // Color palette cycling during charge phase
  useEffect(() => {
    if (phase !== "charge") return;
    const interval = setInterval(() => {
      setColorState((prev) => (prev + 1) % 6);
    }, 80);
    return () => clearInterval(interval);
  }, [phase]);

  // Generate floating rock debris & energy particle debris during charge phase
  useEffect(() => {
    if (phase !== "charge" && phase !== "beam") return;

    const interval = setInterval(() => {
      const isLeft = attackerSide === "left";
      const startX = isLeft ? 22 : 78;
      const newP = Array.from({ length: 5 }).map((_, i) => ({
        id: Math.random() + i,
        x: startX + (Math.random() - 0.5) * 24,
        y: 65 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 3,
        vy: -3 - Math.random() * 5,
        color:
          Math.random() > 0.6
            ? "var(--neon-pink)"
            : Math.random() > 0.3
            ? "var(--neon-cyan)"
            : "var(--neon-yellow)",
        size: Math.floor(Math.random() * 7) + 3,
      }));
      setParticles((prev) => [...prev.slice(-35), ...newP]);
    }, 90);

    return () => clearInterval(interval);
  }, [phase, attackerSide]);

  const isLeft = attackerSide === "left";
  const attackerXPercent = isLeft ? 22 : 78;
  const targetXPercent = isLeft ? 78 : 22;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
      {/* GLOBAL CRT SCANLINES & HEAVY VIGNETTE */}
      <CrtVignetteOverlay />

      {/* PHASE 1: FREEZE & SPOTLIGHT FOCUS */}
      {phase === "freeze" && (
        <FreezePhase attackerXPercent={attackerXPercent} />
      )}

      {/* PHASE 2: TRIPLE ANIME SLASH & ULTIMATE SLASH TEXT */}
      {phase === "slash" && (
        <SlashPhase />
      )}

      {/* PHASE 3: CHARGE & CHARACTER FOCUS */}
      {phase === "charge" && (
        <ChargePhase
          attackerXPercent={attackerXPercent}
          particles={particles}
          colorState={colorState}
        />
      )}

      {/* PHASE 4: PAUSE (1-FRAME ABSOLUTE STILLNESS) */}
      {phase === "pause" && (
        <PausePhase />
      )}

      {/* PHASE 5: BEAM ERUPTION & MULTI-LAYER LASER */}
      {(phase === "beam" || phase === "impact") && (
        <BeamPhase isLeft={isLeft} phase={phase} />
      )}

      {/* PHASE 6: MULTI-STAGE EXPLOSIVE IMPACT */}
      {phase === "impact" && (
        <ImpactPhase targetXPercent={targetXPercent} colorState={colorState} />
      )}

      {/* PHASE 7: LINGERING DISSIPATION & HEAT DISTORTION */}
      {phase === "dissipate" && (
        <DissipatePhase targetXPercent={targetXPercent} />
      )}
    </div>
  );
}

/* ============================================================================
 * HELPER SUB-COMPONENTS (Clean Modular VFX Architecture)
 * ============================================================================ */

function CrtVignetteOverlay() {
  return (
    <>
      {/* Heavy Arcade Vignette */}
      <div
        className="absolute inset-0 z-50 pointer-events-none opacity-80"
        style={{
          background:
            "radial-gradient(circle at center, transparent 35%, rgba(5, 5, 12, 0.85) 85%, rgba(0, 0, 0, 0.98) 100%)",
        }}
      />
      {/* CRT Retro Scanlines */}
      <div
        className="absolute inset-0 z-50 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.7) 0px, rgba(0,0,0,0.7) 1px, transparent 1px, transparent 3px)",
        }}
      />
      {/* Chromatic aberration edge tint */}
      <div className="absolute inset-0 z-50 pointer-events-none mix-blend-screen opacity-30 border-[3px] border-cyan-500/40" />
    </>
  );
}

function FreezePhase({ attackerXPercent }: { attackerXPercent: number }) {
  return (
    <div className="absolute inset-0 z-40">
      {/* Initial 1-frame White Flash */}
      <div className="absolute inset-0 bg-white animate-fade-out z-50" />

      {/* Stage Desaturation & High Contrast Shadow */}
      <div className="absolute inset-0 bg-black/60 backdrop-grayscale backdrop-brightness-50 backdrop-contrast-125 transition-all duration-100 z-10" />

      {/* Spotlight Aura highlighting the attacker character */}
      <div
        className="absolute bottom-[22%] -translate-x-1/2 w-[320px] h-[320px] rounded-full mix-blend-screen animate-pulse z-20 pointer-events-none"
        style={{
          left: `${attackerXPercent}%`,
          background:
            "radial-gradient(circle at center, rgba(0,255,255,0.45) 0%, rgba(224,36,195,0.25) 50%, transparent 75%)",
          boxShadow: "0 0 70px rgba(0,255,255,0.6)",
        }}
      />
    </div>
  );
}

function SlashPhase() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-40">
      {/* 3 Layered Anime Sword Slashes (Black, Purple, White) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Layer 1: Heavy Black Silhouette Slash */}
        <div
          className="absolute h-[24px] w-[160%] bg-black opacity-90 animate-slash-blade"
          style={{ transform: "rotate(-25deg) translateY(-8px)" }}
        />
        {/* Layer 2: Glowing Purple Anime Slash */}
        <div
          className="absolute h-[12px] w-[150%] bg-[var(--neon-pink)] opacity-90 mix-blend-screen animate-slash-blade"
          style={{
            transform: "rotate(-25deg)",
            boxShadow: "0 0 40px #e024c3, 0 0 80px #9d26d0",
          }}
        />
        {/* Layer 3: White-Hot Core Blade Edge */}
        <div
          className="absolute h-[4px] w-[140%] bg-white mix-blend-screen animate-slash-blade"
          style={{
            transform: "rotate(-25deg) translateY(2px)",
            boxShadow: "0 0 20px #ffffff, 0 0 40px #00ffff",
          }}
        />
      </div>

      {/* Violent Anime ULTIMATE Slash Text */}
      <div className="relative z-50 flex items-center justify-center">
        <div
          className="text-7xl sm:text-8xl md:text-9xl font-black italic tracking-tighter uppercase animate-anime-slash"
          style={{
            color: "#ffffff",
            textShadow:
              "6px 6px 0 #e024c3, -4px -4px 0 #00ffff, 0 0 30px #ffffff, 0 0 60px #e024c3",
            fontFamily: "monospace, sans-serif",
          }}
        >
          ULTIMATE
        </div>
      </div>

      {/* Energy speed streaks */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(45deg, transparent 40%, rgba(0,255,255,0.6) 48%, rgba(224,36,195,0.6) 52%, transparent 60%)",
          backgroundSize: "250% 250%",
        }}
      />
    </div>
  );
}

function ChargePhase({
  attackerXPercent,
  particles,
  colorState,
}: {
  attackerXPercent: number;
  particles: { id: number; x: number; y: number; vx: number; vy: number; color: string; size: number }[];
  colorState: number;
}) {
  const auraColor = colorState % 2 === 0 ? "var(--neon-pink)" : "var(--neon-cyan)";

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* Darkened focus backdrop with camera zoom focus */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] z-0 scale-[1.04] transition-transform duration-700" />

      {/* Rotating Energy Rings at attacker's feet */}
      <div
        className="absolute bottom-[24%] -translate-x-1/2 w-[240px] h-[75px] pointer-events-none z-10"
        style={{ left: `${attackerXPercent}%` }}
      >
        {/* Rotating Concentric Circle 1 */}
        <div
          className="absolute top-1/2 left-1/2 w-[200px] h-[55px] rounded-[100%] border-2 border-dashed border-[var(--neon-cyan)] animate-rotate-ring mix-blend-screen opacity-80"
          style={{ boxShadow: "0 0 20px var(--neon-cyan)" }}
        />
        {/* Rotating Concentric Circle 2 */}
        <div
          className="absolute top-1/2 left-1/2 w-[140px] h-[40px] rounded-[100%] border-2 border-[var(--neon-pink)] animate-rotate-ring mix-blend-screen opacity-90"
          style={{ boxShadow: "0 0 25px var(--neon-pink)", animationDirection: "reverse" }}
        />
      </div>

      {/* Expanding Pulsing Aura behind character */}
      <div
        className="absolute bottom-[18%] -translate-x-1/2 w-[300px] h-[300px] rounded-full mix-blend-screen animate-pulse z-10"
        style={{
          left: `${attackerXPercent}%`,
          background: `radial-gradient(circle at center, ${auraColor} 0%, rgba(157,38,208,0.45) 45%, transparent 75%)`,
          boxShadow: `0 0 60px ${auraColor}, 0 0 120px var(--neon-purple)`,
        }}
      />

      {/* Upward Drifting Rock & Debris Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute retro-sprite transition-transform duration-300 z-20"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 12px ${p.color}`,
            transform: `translate(${p.vx * 12}px, ${p.vy * 12}px) rotate(${p.id * 40}deg)`,
          }}
        />
      ))}

      {/* Flickering SVG Lightning Arcs around attacker */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 animate-lightning">
        <path
          d={`M ${attackerXPercent - 4} 75 L ${attackerXPercent - 8} 50 L ${attackerXPercent - 2} 40 L ${attackerXPercent - 6} 20`}
          stroke="var(--neon-cyan)"
          strokeWidth="3"
          fill="none"
          filter="drop-shadow(0 0 8px #00ffff)"
        />
        <path
          d={`M ${attackerXPercent + 5} 70 L ${attackerXPercent + 9} 52 L ${attackerXPercent + 3} 38 L ${attackerXPercent + 7} 22`}
          stroke="var(--neon-pink)"
          strokeWidth="3"
          fill="none"
          filter="drop-shadow(0 0 8px #e024c3)"
        />
      </svg>
    </div>
  );
}

function PausePhase() {
  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center z-50 pointer-events-none">
      {/* Single-frame razor horizontal stillness line */}
      <div className="w-full h-[1px] bg-white opacity-80 mix-blend-screen shadow-[0_0_15px_#ffffff]" />
    </div>
  );
}

function BeamPhase({ isLeft, phase }: { isLeft: boolean; phase: string }) {
  const originX = isLeft ? "20%" : "80%";

  return (
    <div className="absolute inset-0 overflow-hidden z-30 pointer-events-none">
      {/* Initial Eruption White Flash */}
      {phase === "beam" && (
        <div className="absolute inset-0 bg-white animate-fade-out z-50" />
      )}

      {/* Erupting Plasma Origin Sphere at Attacker's Hands */}
      <div
        className="absolute top-[56%] -translate-y-1/2 -translate-x-1/2 w-[160px] h-[160px] rounded-full mix-blend-screen z-40 animate-ping"
        style={{
          left: originX,
          background:
            "radial-gradient(circle at center, #ffffff 0%, #00ffff 40%, #e024c3 70%, transparent 100%)",
          boxShadow: "0 0 60px #ffffff, 0 0 120px #00ffff",
        }}
      />

      {/* Layer 1: Outer Purple Energy Aura with Smooth Top/Bottom Linear Fade */}
      <div
        className="absolute top-[56%] -translate-y-1/2 h-[240px] pointer-events-none mix-blend-screen z-20 animate-pulse"
        style={{
          left: isLeft ? "14%" : "0%",
          right: isLeft ? "0%" : "14%",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(157,38,208,0.05) 8%, rgba(224,36,195,0.35) 25%, rgba(157,38,208,0.55) 50%, rgba(224,36,195,0.35) 75%, rgba(157,38,208,0.05) 92%, transparent 100%)",
          filter: "blur(6px)",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 15%, rgba(0,0,0,1) 38%, rgba(0,0,0,1) 62%, rgba(0,0,0,0.3) 85%, transparent 100%)",
          maskImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 15%, rgba(0,0,0,1) 38%, rgba(0,0,0,1) 62%, rgba(0,0,0,0.3) 85%, transparent 100%)",
        }}
      />

      {/* Layer 2: Condensed White-Hot Plasma Core Laser Beam */}
      <div
        className="absolute top-[56%] -translate-y-1/2 h-[140px] pointer-events-none flex items-center mix-blend-screen z-30"
        style={{
          left: isLeft ? "20%" : "5%",
          right: isLeft ? "5%" : "20%",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(224,36,195,0.35) 18%, rgba(255,255,255,0.95) 42%, rgba(255,255,255,0.95) 58%, rgba(0,255,255,0.35) 82%, transparent 100%)",
          boxShadow:
            "0 0 35px rgba(255,255,255,0.95), 0 0 70px rgba(224,36,195,0.7), 0 0 90px rgba(0,255,255,0.7) inset",
          borderRadius: isLeft ? "50px 15px 15px 50px" : "15px 50px 50px 15px",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 15%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 65%, rgba(0,0,0,0.5) 85%, transparent 100%)",
          maskImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 15%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 65%, rgba(0,0,0,0.5) 85%, transparent 100%)",
        }}
      >
        {/* Layer 3: Flowing Speed Lines inside beam */}
        <div
          className="absolute inset-0 opacity-45 mix-blend-screen animate-beam-flow"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.7) 0 15px, transparent 15px 35px)",
            backgroundSize: "70px 100%",
          }}
        />
        {/* Layer 4: Electric arcs */}
        <div
          className="absolute inset-0 animate-pulse opacity-70 mix-blend-screen"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, rgba(0,255,255,0.8) 0%, transparent 60%), radial-gradient(circle at 70% 50%, rgba(224,36,195,0.8) 0%, transparent 60%)",
          }}
        />
      </div>
    </div>
  );
}

function ImpactPhase({
  targetXPercent,
  colorState,
}: {
  targetXPercent: number;
  colorState: number;
}) {
  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      {/* Alternating color impact flash */}
      <div
        className="absolute inset-0 animate-pulse opacity-35 mix-blend-screen"
        style={{
          backgroundColor: colorState % 2 === 0 ? "#e024c3" : "#00ffff",
        }}
      />

      {/* Layered Multi-Ring Shockwaves & Explosive Burst */}
      <div
        className="absolute top-[56%] -translate-y-1/2 flex items-center justify-center z-40"
        style={{
          left: `${targetXPercent}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Expanding Shockwave Ring 1 (Inner White-Hot) */}
        <div
          className="w-[280px] h-[280px] rounded-full border-4 border-white animate-shockwave mix-blend-screen"
          style={{
            boxShadow: "0 0 50px #ffffff, 0 0 100px #e024c3, 0 0 150px #00ffff",
          }}
        />
        {/* Expanding Shockwave Ring 2 (Outer Cyan) */}
        <div
          className="absolute w-[360px] h-[360px] rounded-full border-2 border-[var(--neon-cyan)] animate-shockwave mix-blend-screen"
          style={{
            animationDelay: "0.15s",
            boxShadow: "0 0 40px #00ffff",
          }}
        />

        {/* 360-Degree Starburst Hit Sparks */}
        <svg
          width="340"
          height="340"
          viewBox="-170 -170 340 340"
          className="absolute animate-spin mix-blend-screen"
        >
          <g style={{ filter: "drop-shadow(0 0 20px #ffffff)" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <path
                key={i}
                d="M 0 -135 L 18 -18 L 135 0 L 18 18 L 0 135 L -18 18 L -135 0 L -18 -18 Z"
                fill={i % 2 === 0 ? "#00ffff" : "#e024c3"}
                transform={`rotate(${i * 30}) scale(${0.6 + (i % 3) * 0.3})`}
              />
            ))}
            <circle cx="0" cy="0" r="42" fill="#ffffff" />
          </g>
        </svg>

        {/* AAA Clean Anime High-Impact Typography */}
        <div
          className="absolute text-5xl sm:text-6xl md:text-7xl font-black italic uppercase tracking-tighter text-yellow-300 animate-bounce whitespace-nowrap z-50"
          style={{
            textShadow:
              "4px 4px 0 #000000, -3px -3px 0 #ff0044, 0 0 35px #ffcc00, 0 0 70px #e024c3",
            fontFamily: "monospace, sans-serif",
            transform: "skewX(-10deg)",
          }}
        >
          CRITICAL HIT!
        </div>
      </div>
    </div>
  );
}

function DissipatePhase({ targetXPercent }: { targetXPercent: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Heat Distortion overlay fading out */}
      <div className="absolute inset-0 animate-heat opacity-40 mix-blend-screen" />

      {/* Floating purple embers at target site */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full mix-blend-screen animate-fade-out"
        style={{
          left: `${targetXPercent}%`,
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle at center, rgba(224,36,195,0.4) 0%, rgba(157,38,208,0.2) 50%, transparent 80%)",
          filter: "blur(10px)",
        }}
      />
    </div>
  );
}
