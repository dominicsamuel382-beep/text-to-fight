import React, { useState, useEffect } from "react";

interface SpriteAnimationProps {
  src: string;
  pose: "idle" | "punch" | "kick" | "block" | "dodge" | "aerial" | "special" | "hurt" | "ko";
  side: "left" | "right";
  hurt: boolean;
}

const POSE_MAP: Record<string, { row: number; col: number }> = {
  idle: { row: 0, col: 0 },
  punch: { row: 0, col: 1 },
  kick: { row: 0, col: 2 },
  block: { row: 1, col: 0 },
  dodge: { row: 1, col: 1 },
  aerial: { row: 1, col: 2 },
  hurt: { row: 2, col: 0 },
  special: { row: 2, col: 1 },
  ko: { row: 2, col: 2 },
};

export function SpriteAnimation({ src, pose, side, hurt }: SpriteAnimationProps) {
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
        className="retro-sprite relative"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          backgroundImage: `url(${src})`,
          backgroundSize: `${displayWidth * 3}px ${displayHeight * 3}px`,
          backgroundPosition: `-${col * displayWidth}px -${row * displayHeight}px`,
          backgroundRepeat: "no-repeat",
          transform: `scaleX(${flip})`,
          filter: hurt ? "hue-rotate(-40deg) brightness(1.6) drop-shadow(0 0 8px red)" : undefined,
          opacity,
        }}
      />
    </div>
  );
}
