import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion"; // Corrected import
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createNoise3D } from "simplex-noise";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility function for className merging
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Vortex Component
const Vortex = (props) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const particleCount = props.particleCount || 700;
  const particlePropCount = 9;
  const particlePropsLength = particleCount * particlePropCount;
  const rangeY = props.rangeY || 100;
  const baseTTL = 50;
  const rangeTTL = 150;
  const baseSpeed = props.baseSpeed || 0.0;
  const rangeSpeed = props.rangeSpeed || 1.5;
  const baseRadius = props.baseRadius || 1;
  const rangeRadius = props.rangeRadius || 2;
  const baseHue = props.baseHue || 220;
  const rangeHue = 100;
  const noiseSteps = 3;
  const xOff = 0.00125;
  const yOff = 0.00125;
  const zOff = 0.0005;
  const backgroundColor = props.backgroundColor || "#000000";
  let tick = 0;
  const noise3D = createNoise3D();
  let particleProps = new Float32Array(particlePropsLength);
  let center = [0, 0];

  const HALF_PI = 0.5 * Math.PI;
  const TAU = 2 * Math.PI;
  const TO_RAD = Math.PI / 180;
  const rand = (n) => n * Math.random();
  const randRange = (n) => n - rand(2 * n);
  const fadeInOut = (t, m) => {
    let hm = 0.5 * m;
    return Math.abs(((t + hm) % m) - hm) / hm;
  };
  const lerp = (n1, n2, speed) => (1 - speed) * n1 + speed * n2;

  const setup = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas && container) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        resize(canvas, ctx);
        initParticles();
        draw(canvas, ctx);
      }
    }
  };

  const initParticles = () => {
    tick = 0;
    particleProps = new Float32Array(particlePropsLength);
    for (let i = 0; i < particlePropsLength; i += particlePropCount) {
      initParticle(i);
    }
  };

  const initParticle = (i) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let x = rand(canvas.width);
    let y = center[1] + randRange(rangeY);
    let vx = 0;
    let vy = 0;
    let life = 0;
    let ttl = baseTTL + rand(rangeTTL);
    let speed = baseSpeed + rand(rangeSpeed);
    let radius = baseRadius + rand(rangeRadius);
    let hue = baseHue + rand(rangeHue);

    particleProps.set([x, y, vx, vy, life, ttl, speed, radius, hue], i);
  };

  const draw = (canvas, ctx) => {
    tick++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawParticles(ctx);
    renderGlow(canvas, ctx);
    renderToScreen(canvas, ctx);
    window.requestAnimationFrame(() => draw(canvas, ctx));
  };

  const drawParticles = (ctx) => {
    for (let i = 0; i < particlePropsLength; i += particlePropCount) {
      updateParticle(i, ctx);
    }
  };

  const updateParticle = (i, ctx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let i2 = 1 + i,
      i3 = 2 + i,
      i4 = 3 + i,
      i5 = 4 + i,
      i6 = 5 + i,
      i7 = 6 + i,
      i8 = 7 + i,
      i9 = 8 + i;
    let x = particleProps[i];
    let y = particleProps[i2];
    let n = noise3D(x * xOff, y * yOff, tick * zOff) * noiseSteps * TAU;
    let vx = lerp(particleProps[i3], Math.cos(n), 0.5);
    let vy = lerp(particleProps[i4], Math.sin(n), 0.5);
    let life = particleProps[i5];
    let ttl = particleProps[i6];
    let speed = particleProps[i7];
    let x2 = x + vx * speed;
    let y2 = y + vy * speed;
    let radius = particleProps[i8];
    let hue = particleProps[i9];

    drawParticle(x, y, x2, y2, life, ttl, radius, hue, ctx);

    life++;
    particleProps[i] = x2;
    particleProps[i2] = y2;
    particleProps[i3] = vx;
    particleProps[i4] = vy;
    particleProps[i5] = life;

    (checkBounds(x, y, canvas) || life > ttl) && initParticle(i);
  };

  const drawParticle = (x, y, x2, y2, life, ttl, radius, hue, ctx) => {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = radius;
    ctx.strokeStyle = `hsla(${hue},100%,60%,${fadeInOut(life, ttl)})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  };

  const checkBounds = (x, y, canvas) => {
    return x > canvas.width || x < 0 || y > canvas.height || y < 0;
  };

  const resize = (canvas, ctx) => {
    const { innerWidth, innerHeight } = window;
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    center[0] = 0.5 * canvas.width;
    center[1] = 0.5 * canvas.height;
  };

  const renderGlow = (canvas, ctx) => {
    ctx.save();
    ctx.filter = "blur(8px) brightness(200%)";
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.filter = "blur(4px) brightness(200%)";
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  };

  const renderToScreen = (canvas, ctx) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  };

  useEffect(() => {
    setup();
    window.addEventListener("resize", () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) resize(canvas, ctx);
    });
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className={cn("relative h-full w-full", props.containerClassName)}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        ref={containerRef}
        className="absolute h-full w-full inset-0 z-0 bg-transparent flex items-center justify-center"
      >
        <canvas ref={canvasRef}></canvas>
      </motion.div>
      <div className={cn("relative z-10", props.className)}>
        {props.children}
      </div>
    </div>
  );
};

// HeroSection Component
export default function HeroSection() {
  return (
    <div className="relative w-full h-screen flex flex-col justify-center items-center">
      {/* Vortex Background */}
      <Vortex
        backgroundColor="transparent"
        className="absolute inset-0 z-0"
        particleCount={700}
        baseHue={200}
        rangeHue={50}
        baseSpeed={0.2}
        rangeSpeed={1.0}
        baseRadius={1.5}
        rangeRadius={2.5}
      />

      {/* Main Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10">
        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7 }}
          className="text-3xl sm:text-5xl md:text-6xl font-extrabold drop-shadow-lg"
          style={{
            background: "linear-gradient(to right, #0D9488, #3B82F6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Décrochez l’emploi de vos rêves assistée par
          l’IA
        </motion.h1>

        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-4 text-lg sm:text-xl max-w-2xl drop-shadow-md text-black"
        >
          Recevez un retour immédiat, progressez rapidement et décrochez le
          poste de vos rêves. 95 % des utilisateurs ont gagné en confiance après
          seulement 3 sessions.
        </motion.p>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-8"
        >
          <motion.a
            whileHover={{
              scale: 1.05,
              background: "linear-gradient(to right, #2563EB, #1E40AF)",
              boxShadow: "0 0 15px rgba(37, 99, 235, 0.5)",
            }}
            whileTap={{ scale: 0.95 }}
            href="#pricing"
            className="bg-gradient-to-r from-[#2563EB] to-[#1E40AF] text-white font-bold py-3 px-8 rounded-full inline-flex items-center transition-all duration-300"
          >
            <Link to="/Offres" className="text-white">
              Postulez à l’emploi de vos rêves
            </Link>
            <ChevronRight className="ml-2 text-white" size={20} />
          </motion.a>
        </motion.div>
      </div>

      {/* Floating Particles */}
      {Array.from({ length: 10 }).map((_, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            width: `${Math.random() * 5 + 2}px`,
            height: `${Math.random() * 5 + 2}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            backgroundColor: "#2563EB40",
          }}
          animate={{
            y: [0, -50 - Math.random() * 30],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: Math.random() * 5 + 3,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
