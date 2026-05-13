'use client';

import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'ball' | 'confetti';
  size: number;
  color: string;
  rotation: number;
  vRotation: number;
};

const CONFETTI_COLORS = [
  '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6',
  '#ec4899', '#10b981', '#f97316', '#ffffff', '#fbbf24',
];
const GRAVITY = 1800; // px/s^2
const DURATION = 2000; // ms

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function drawTennisBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
) {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#c8e64c';
  ctx.fill();

  ctx.strokeStyle = 'white';
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-r * 0.62, -r * 0.62);
  ctx.quadraticCurveTo(0, 0, -r * 0.62, r * 0.62);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(r * 0.62, -r * 0.62);
  ctx.quadraticCurveTo(0, 0, r * 0.62, r * 0.62);
  ctx.stroke();

  ctx.restore();
}

function drawConfetti(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  rotation: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

export default function TennisBallCelebration({
  origin,
  onDone,
}: {
  origin: { x: number; y: number };
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];

    // Random spread tennis balls
    for (let i = 0; i < 25; i++) {
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: rand(-520, 520),
        vy: rand(-1300, -350),
        type: 'ball',
        size: rand(18, 38),
        color: '#c8e64c',
        rotation: rand(0, Math.PI * 2),
        vRotation: rand(-7, 7),
      });
    }

    // Directed tennis balls at 60 degrees left and right of straight up.
    // 60 deg from vertical: vx = ±sin(60°)*speed, vy = -cos(60°)*speed
    const SIN75 = Math.sin(Math.PI * 75 / 180);
    const COS75 = Math.cos(Math.PI * 75 / 180);
    for (let i = 0; i < 8; i++) {
      const speed = rand(900, 1500);
      // Left burst
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: -SIN75 * speed,
        vy: -COS75 * speed,
        type: 'ball',
        size: rand(22, 42),
        color: '#c8e64c',
        rotation: rand(0, Math.PI * 2),
        vRotation: rand(-9, 9),
      });
    }
    for (let i = 0; i < 8; i++) {
      const speed = rand(900, 1500);
      // Right burst
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: SIN75 * speed,
        vy: -COS75 * speed,
        type: 'ball',
        size: rand(22, 42),
        color: '#c8e64c',
        rotation: rand(0, Math.PI * 2),
        vRotation: rand(-9, 9),
      });
    }

    // Confetti strips
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: rand(-600, 600),
        vy: rand(-1400, -200),
        type: 'confetti',
        size: rand(5, 13),
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: rand(0, Math.PI * 2),
        vRotation: rand(-14, 14),
      });
    }

    const startTime = performance.now();
    let animId: number;
    let done = false;

    function draw(now: number) {
      if (!ctx || !canvas) return;
      const t = (now - startTime) / 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        const x = p.x + p.vx * t;
        const y = p.y + p.vy * t + 0.5 * GRAVITY * t * t;
        const rot = p.rotation + p.vRotation * t;

        if (p.type === 'ball') {
          drawTennisBall(ctx, x, y, p.size, rot);
        } else {
          drawConfetti(ctx, x, y, p.size * 2.2, p.size, p.color, rot);
        }
      }

      if (!done) {
        if (now - startTime < DURATION) {
          animId = requestAnimationFrame(draw);
        } else {
          done = true;
          onDone();
        }
      }
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [origin, onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
