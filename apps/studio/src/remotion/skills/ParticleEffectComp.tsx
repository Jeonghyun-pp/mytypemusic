/**
 * ParticleEffect — decorative particle animations as backgrounds or overlays.
 *
 * Use cases: celebration effects, atmospheric backgrounds, visual accents.
 * Uses deterministic pseudo-random (seeded from index) for Remotion compatibility.
 */
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { z } from "zod";
import { CLAMP, hexToRgba } from "./types";

// ── Schema ───────────────────────────────────────────

export const particleEffectSchema = z.object({
  particleCount: z.number().default(40),
  particleType: z.enum(["circle", "square", "star", "confetti"]).default("circle"),
  colors: z.array(z.string()).default(["#6C5CE7", "#00CEC9", "#FD79A8", "#FDCB6E", "#E17055"]),
  backgroundColor: z.string().default("#0A0A1A"),
  direction: z.enum(["up", "down", "radial", "random"]).default("up"),
  speed: z.number().default(1),
  minSize: z.number().default(4),
  maxSize: z.number().default(16),
  title: z.string().default(""),
  subtitle: z.string().default(""),
  textColor: z.string().default("#FFFFFF"),
  fontFamily: z.string().default("Pretendard, sans-serif"),
  holdFrames: z.number().default(150),
  seed: z.number().default(42),
});

export type ParticleEffectProps = z.infer<typeof particleEffectSchema>;

export function calculateParticleDuration(props: ParticleEffectProps): number {
  return props.holdFrames;
}

// ── Deterministic random ─────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Star shape ───────────────────────────────────────

function starPath(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.4;
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return `M${points.join("L")}Z`;
}

// ── Main composition ─────────────────────────────────

export const ParticleEffectComp: React.FC<ParticleEffectProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const {
    particleCount, particleType, colors, backgroundColor, direction,
    speed, minSize, maxSize, title, subtitle, textColor, fontFamily, seed,
  } = props;

  const rng = seededRandom(seed);

  // Pre-generate particles (deterministic)
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    x: rng() * width,
    y: rng() * height,
    size: minSize + rng() * (maxSize - minSize),
    color: colors[Math.floor(rng() * colors.length)]!,
    speed: 0.5 + rng() * 1.5,
    phase: rng() * Math.PI * 2,
    rotation: rng() * 360,
  }));

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], CLAMP);
  const titleY = interpolate(frame, [0, 20], [30, 0], CLAMP);

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* Particles */}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute" }}>
        {particles.map((p, i) => {
          const t = (frame * speed * p.speed) / 30;
          let px = p.x;
          let py = p.y;

          switch (direction) {
            case "up":
              py = ((p.y - t * 120) % (height + 40) + height + 40) % (height + 40) - 20;
              px = p.x + Math.sin(t * 2 + p.phase) * 20;
              break;
            case "down":
              py = ((p.y + t * 120) % (height + 40) + height + 40) % (height + 40) - 20;
              px = p.x + Math.sin(t * 2 + p.phase) * 20;
              break;
            case "radial": {
              const cx = width / 2;
              const cy = height / 2;
              const angle = p.phase + t * 0.5;
              const dist = (t * 60 * p.speed) % (Math.max(width, height) / 2);
              px = cx + Math.cos(angle) * dist;
              py = cy + Math.sin(angle) * dist;
              break;
            }
            case "random":
              px = p.x + Math.sin(t * 1.5 + p.phase) * 60;
              py = p.y + Math.cos(t * 1.2 + p.phase * 0.7) * 60;
              break;
          }

          const opacity = interpolate(frame, [0, 15], [0, 0.8], CLAMP);
          const rot = p.rotation + frame * p.speed * 2;

          if (particleType === "circle") {
            return <circle key={String(i)} cx={px} cy={py} r={p.size / 2} fill={p.color} opacity={opacity} />;
          }
          if (particleType === "square" || particleType === "confetti") {
            const w = particleType === "confetti" ? p.size * 0.6 : p.size;
            const h2 = particleType === "confetti" ? p.size * 1.5 : p.size;
            return (
              <rect
                key={String(i)}
                x={px - w / 2} y={py - h2 / 2}
                width={w} height={h2}
                fill={p.color} opacity={opacity}
                rx={particleType === "confetti" ? 2 : 0}
                transform={`rotate(${rot} ${px} ${py})`}
              />
            );
          }
          // star
          return <path key={String(i)} d={starPath(px, py, p.size)} fill={p.color} opacity={opacity} />;
        })}
      </svg>

      {/* Text overlay */}
      {(title || subtitle) && (
        <AbsoluteFill style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontFamily,
          gap: "16px",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}>
          {title && (
            <div style={{
              fontSize: 56,
              fontWeight: 800,
              color: textColor,
              textAlign: "center" as const,
              textShadow: "2px 2px 12px rgba(0,0,0,0.7)",
            }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{
              fontSize: 28,
              fontWeight: 400,
              color: textColor,
              textAlign: "center" as const,
              opacity: 0.85,
              textShadow: "1px 1px 8px rgba(0,0,0,0.6)",
            }}>
              {subtitle}
            </div>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
