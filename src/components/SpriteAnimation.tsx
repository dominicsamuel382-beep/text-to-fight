import React, { useState, useEffect } from "react";

export type FighterPose =
  | "idle"
  | "punch"
  | "kick"
  | "block"
  | "dodge"
  | "aerial"
  | "special"
  | "dash"
  | "hurt"
  | "ko";

interface SpriteAnimationProps {
  src: string;
  pose: FighterPose;
  side: "left" | "right";
  hurt: boolean;
  colorCycleIndex?: number;
}

const POSE_MAP: Record<FighterPose, { row: number; col: number }> = {
  idle: { row: 0, col: 0 },
  punch: { row: 0, col: 1 },
  kick: { row: 0, col: 2 },
  block: { row: 1, col: 0 },
  dodge: { row: 1, col: 1 },
  aerial: { row: 1, col: 2 },
  special: { row: 2, col: 0 },
  dash: { row: 2, col: 1 },
  ko: { row: 2, col: 2 },
  hurt: { row: 2, col: 1 },
};

const SPECIAL_COLOR_FILTERS = [
  "brightness(1) drop-shadow(0 0 16px #e024c3)",
  "hue-rotate(60deg) brightness(1.4) drop-shadow(0 0 20px #9d26d0)",
  "hue-rotate(180deg) brightness(1.4) drop-shadow(0 0 20px #00ffff)",
  "brightness(10) drop-shadow(0 0 24px #ffffff)",
  "brightness(0.1) drop-shadow(0 0 16px #00ffff)",
  "brightness(1.2) drop-shadow(0 0 24px #ffcc00)",
];

export function SpriteAnimation({ src, pose, side, hurt, colorCycleIndex = 0 }: SpriteAnimationProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setDimensions({ width: img.width, height: img.height });
    };
  }, [src]);

  // Fallback box structure during loading to prevent visual shifts
  if (!dimensions) {
    return <div style={{ width: "270px", height: "270px" }} />;
  }

  const frameWidth = dimensions.width / 3;
  const frameHeight = dimensions.height / 3;

  // Scale the 418x418 sprite frame down slightly (e.g. 0.65) to fit the stage perfectly
  const scale = 0.65;
  const displayWidth = frameWidth * scale;
  const displayHeight = frameHeight * scale;

  const { row, col } = POSE_MAP[pose] || { row: 0, col: 0 };
  const flip = side === "right" ? -1 : 1;
  const opacity = pose === "ko" ? 0.6 : 1;

  let activeFilter: string | undefined = undefined;
  if (hurt) {
    activeFilter = "hue-rotate(-40deg) brightness(1.6) drop-shadow(0 0 8px red)";
  } else if (pose === "special") {
    activeFilter = SPECIAL_COLOR_FILTERS[colorCycleIndex % SPECIAL_COLOR_FILTERS.length];
  }

  return (
    <div
      className="relative flex flex-col items-center justify-end"
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
      }}
    >
      {/* Soft floor shadow to anchor the fighter visually */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-[12px] bg-black/45 rounded-full blur-[2px]"
        style={{
          transform: `translateX(-50%) scale(${pose === "aerial" ? 0.6 : 1})`,
          opacity: pose === "aerial" ? 0.3 : 1,
        }}
      />
      {/* Active Sprite Frame cropped from the sprite sheet */}
      <div
        className="retro-sprite relative transition-all duration-75"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          backgroundImage: `url(${src})`,
          backgroundSize: `${displayWidth * 3}px ${displayHeight * 3}px`,
          backgroundPosition: `-${col * displayWidth}px -${row * displayHeight}px`,
          backgroundRepeat: "no-repeat",
          transform: `scaleX(${flip})`,
          filter: activeFilter,
          opacity,
        }}
      />
    </div>
  );
}
