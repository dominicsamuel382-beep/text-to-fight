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

  // Sparks and particles
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

  // Color palette cycling during charge up phase
  useEffect(() => {
    if (phase !== "charge") return;
    const interval = setInterval(() => {
      setColorState((prev) => (prev + 1) % 6);
    }, 80);
    return () => clearInterval(interval);
  }, [phase]);

  // Generate floating particle debris during charge phase
  useEffect(() => {
    if (phase !== "charge" && phase !== "beam") return;

    const interval = setInterval(() => {
      const isLeft = attackerSide === "left";
      const startX = isLeft ? 25 : 75;
      const newP = Array.from({ length: 4 }).map((_, i) => ({
        id: Math.random() + i,
        x: startX + (Math.random() - 0.5) * 20,
        y: 60 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -2 - Math.random() * 4,
        color: Math.random() > 0.5 ? "var(--neon-pink)" : "var(--neon-cyan)",
        size: Math.floor(Math.random() * 6) + 4,
      }));
      setParticles((prev) => [...prev.slice(-30), ...newP]);
    }, 100);

    return () => clearInterval(interval);
  }, [phase, attackerSide]);

  const isLeft = attackerSide === "left";

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden select-none">
      {/* 1. Freeze & Color Drain Overlay */}
      {phase === "freeze" && (
        <div className="absolute inset-0 bg-black/60 backdrop-grayscale backdrop-brightness-50 transition-all duration-100" />
      )}

      {/* 2. ULTIMATE Title Tear & Diagonal Energy Slash */}
      {phase === "slash" && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {/* Diagonal Energy Slash Line */}
          <div
            className="absolute h-[6px] w-[140%] bg-white animate-pulse"
            style={{
              transform: "rotate(-25deg)",
              boxShadow: "0 0 30px #00ffff, 0 0 60px #e024c3, 0 0 90px #00ffff",
              background: "linear-gradient(90deg, transparent, #00ffff, #ffffff, #e024c3, transparent)",
            }}
          />

          {/* Massive Pixel-art ULTIMATE Banner */}
          <div
            className="text-7xl sm:text-8xl md:text-9xl font-black italic tracking-tighter uppercase animate-slide-across"
            style={{
              color: "#ffffff",
              textShadow:
                "4px 4px 0 #e024c3, -4px -4px 0 #00ffff, 0 0 40px #ffffff, 0 0 80px #e024c3",
              fontFamily: "monospace, sans-serif",
              transform: "skewX(-15deg)",
            }}
          >
            ULTIMATE
          </div>

          {/* Slash energy particle lines */}
          <div
            className="absolute inset-0 opacity-80"
            style={{
              backgroundImage:
                "linear-gradient(45deg, transparent 45%, var(--neon-cyan) 49%, var(--neon-pink) 51%, transparent 55%)",
              backgroundSize: "200% 200%",
            }}
          />
        </div>
      )}

      {/* 3. Energy Charge Up Phase */}
      {phase === "charge" && (
        <div className="absolute inset-0">
          {/* Darkened blurred background focus */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />

          {/* Ground energy cracks under attacker */}
          <div
            className="absolute bottom-[28%] h-3 rounded-full animate-pulse"
            style={{
              left: isLeft ? "15%" : "65%",
              width: "30%",
              background:
                "radial-gradient(ellipse at center, var(--neon-pink) 0%, var(--neon-cyan) 50%, transparent 80%)",
              boxShadow: "0 0 30px var(--neon-pink), 0 0 60px var(--neon-cyan)",
            }}
          />

          {/* Expanding shockwave rings at attacker's feet */}
          <div
            className="absolute bottom-[24%] rounded-full border-4 animate-ping opacity-75"
            style={{
              left: isLeft ? "20%" : "70%",
              width: "120px",
              height: "40px",
              borderColor: "var(--neon-cyan)",
              boxShadow: "0 0 20px var(--neon-cyan)",
            }}
          />

          {/* Upward drifting pixel debris particles */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute retro-sprite transition-transform duration-300"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                boxShadow: `0 0 10px ${p.color}`,
                transform: `translate(${p.vx * 10}px, ${p.vy * 10}px)`,
              }}
            />
          ))}

          {/* Charging Text Indicator */}
          <div
            className="absolute top-[25%] left-1/2 -translate-x-1/2 text-3xl md:text-4xl font-black tracking-[0.4em] text-center uppercase animate-bounce"
            style={{
              color: "var(--neon-yellow)",
              textShadow: "0 0 20px var(--neon-yellow), 2px 2px 0 black",
            }}
          >
            ⚡ OVERPOWER CHARGING ⚡
          </div>
        </div>
      )}

      {/* 4. Stillness / Single-Frame Pause */}
      {phase === "pause" && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
          <div className="w-full h-0.5 bg-white opacity-40" />
        </div>
      )}

      {/* 5. Beam Eruption & Flash */}
      {(phase === "beam" || phase === "impact") && (
        <div className="absolute inset-0 overflow-hidden">
          {/* Intense Full-Screen White Flash */}
          {phase === "beam" && (
            <div className="absolute inset-0 bg-white animate-fade-out z-40" />
          )}

          {/* Gigantic Condensed Energy Beam */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[220px] pointer-events-none flex items-center"
            style={{
              left: isLeft ? "10%" : "0%",
              right: isLeft ? "0%" : "10%",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(224,36,195,0.8) 15%, #ffffff 40%, #ffffff 60%, rgba(0,255,255,0.8) 85%, transparent 100%)",
              boxShadow:
                "0 0 60px #ffffff, 0 0 120px #e024c3, 0 0 180px #00ffff inset",
            }}
          >
            {/* Speed Lines inside beam */}
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, #ffffff 0 20px, transparent 20px 40px)",
                backgroundSize: "80px 100%",
              }}
            />
            {/* Electric arcs */}
            <div
              className="absolute inset-0 animate-pulse opacity-80"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 50%, #00ffff 0%, transparent 60%), radial-gradient(circle at 70% 50%, #e024c3 0%, transparent 60%)",
              }}
            />
          </div>
        </div>
      )}

      {/* 6. Explosive Impact on Target */}
      {phase === "impact" && (
        <div className="absolute inset-0">
          {/* Alternating impact flash overlay */}
          <div
            className="absolute inset-0 animate-pulse opacity-40"
            style={{
              backgroundColor: colorState % 2 === 0 ? "#e024c3" : "#00ffff",
            }}
          />

          {/* Giant Explosion Shockwave & Sparks at target site */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{
              left: isLeft ? "70%" : "20%",
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* Expanding shockwave circle */}
            <div
              className="w-[320px] h-[320px] rounded-full border-8 border-white animate-ping"
              style={{
                boxShadow:
                  "0 0 50px #ffffff, 0 0 100px #e024c3, 0 0 150px #00ffff",
              }}
            />

            {/* Hit sparks burst */}
            <svg
              width="360"
              height="360"
              viewBox="-180 -180 360 360"
              className="absolute animate-spin"
            >
              <g style={{ filter: "drop-shadow(0 0 20px #ffffff)" }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <path
                    key={i}
                    d="M 0 -140 L 20 -20 L 140 0 L 20 20 L 0 140 L -20 20 L -140 0 L -20 -20 Z"
                    fill={i % 2 === 0 ? "#00ffff" : "#e024c3"}
                    transform={`rotate(${i * 30}) scale(${0.6 + (i % 3) * 0.3})`}
                  />
                ))}
                <circle cx="0" cy="0" r="45" fill="#ffffff" />
              </g>
            </svg>

            {/* Impact Text */}
            <div
              className="absolute text-5xl md:text-7xl font-black italic uppercase tracking-wider text-yellow-300 animate-bounce"
              style={{
                textShadow:
                  "0 0 30px #ffcc00, 4px 4px 0 #000000, -2px -2px 0 #ff0044",
              }}
            >
              CRITICAL OBLITERATION!
            </div>
          </div>
        </div>
      )}

      {/* 7. Dissipation */}
      {phase === "dissipate" && (
        <div className="absolute inset-0 bg-black/40 transition-opacity duration-500 opacity-0" />
      )}
    </div>
  );
}
