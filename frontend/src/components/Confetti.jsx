import { useEffect, useRef } from "react";

const COLORS = ["#00e699", "#ffde59", "#ff3b54", "#00d2ff", "#ff7ac6", "#f4f4f6"];
const DURATION_MS = 4500;
const PARTICLE_COUNT = 75;

export default function Confetti() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => {
      const type = Math.random() < 0.25 ? "dollar" : Math.random() < 0.5 ? "coin" : "ribbon";
      return {
        x: width * 0.5 + (Math.random() - 0.5) * 300,
        y: height * 0.45 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 10 - 4,
        size: Math.random() * 8 + 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.1 + 0.05,
        type,
      };
    });

    const startTime = performance.now();
    let frameId = 0;

    const render = (now) => {
      const elapsed = now - startTime;
      if (elapsed > DURATION_MS) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      const progress = elapsed / DURATION_MS;
      const alpha = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = Math.max(0, alpha);

      for (const p of particles) {
        p.x += p.vx + Math.sin(p.wobble) * 1.5;
        p.y += p.vy;
        p.vy += 0.18; // gravity
        p.vx *= 0.99; // drag
        p.rotation += p.rotSpeed;
        p.wobble += p.wobbleSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.type === "dollar") {
          ctx.fillStyle = p.color;
          ctx.font = `bold ${p.size * 1.5}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("$", 0, 0);
        } else if (p.type === "coin") {
          ctx.fillStyle = "#ffde59";
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#c49b10";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size * 0.5, -p.size * 0.25, p.size, p.size * 0.5);
        }

        ctx.restore();
      }

      ctx.globalAlpha = 1;
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
