/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BallState, Particle, PlayerNode, PreloaderConfig, ThemeColors, PreloaderTheme } from './types';
import { soundManager } from './SoundManager';

interface CanvasPreloaderProps {
  config: PreloaderConfig;
  progressOverride?: number; // Optional progress (0-100) to tie to loading progress
  onComplete?: () => void;
  showOverlayUI?: boolean; // Toggle the welcome text / progress bar / status badge chrome
}

export const THEME_PALETTES: Record<PreloaderTheme, ThemeColors> = {
  'midnight-spike': {
    primary: '#6366f1', // Indigo
    secondary: '#ec4899', // Pink
    courtBg: '#0f172a', // Deep Slate
    courtLines: '#334155', // Slate
    net: '#475569',
    ballPrimary: '#facc15', // Yellow
    ballSecondary: '#3b82f6', // Blue
    text: '#f8fafc',
    textMuted: '#94a3b8',
    bgGradStart: 'from-slate-900',
    bgGradEnd: 'to-slate-950',
  },
  'cyber-court': {
    primary: '#06b6d4', // Cyan
    secondary: '#f43f5e', // Neon Rose
    courtBg: '#020617', // Pitch Black
    courtLines: '#1e293b', // Neon borders
    net: '#0f172a',
    ballPrimary: '#10b981', // Emerald
    ballSecondary: '#a855f7', // Purple
    text: '#e2e8f0',
    textMuted: '#64748b',
    bgGradStart: 'from-slate-950',
    bgGradEnd: 'to-black',
  },
  'beach-sunset': {
    primary: '#f97316', // Orange
    secondary: '#8b5cf6', // Violet
    courtBg: '#fef3c7', // Warm Sand
    courtLines: '#d97706', // Golden Line
    net: '#78350f',
    ballPrimary: '#f43f5e', // Coral
    ballSecondary: '#fbbf24', // Yellow
    text: '#1e293b',
    textMuted: '#475569',
    bgGradStart: 'from-amber-50',
    bgGradEnd: 'to-orange-100',
  },
  'olympic-gold': {
    primary: '#d97706', // Gold
    secondary: '#0f766e', // Teal
    courtBg: '#fafafa', // Clean White
    courtLines: '#e4e4e7', // Grey Line
    net: '#71717a',
    ballPrimary: '#3b82f6', // Blue
    ballSecondary: '#eab308', // Yellow
    text: '#18181b',
    textMuted: '#71717a',
    bgGradStart: 'from-zinc-50',
    bgGradEnd: 'to-zinc-200',
  },
  'minimal-chalk': {
    primary: '#14b8a6', // Teal
    secondary: '#6366f1', // Indigo
    courtBg: '#18181b', // Zinc Dark
    courtLines: '#27272a', // Zinc dark line
    net: '#3f3f46',
    ballPrimary: '#f4f4f5', // White Chalk
    ballSecondary: '#71717a', // Dark Chalk
    text: '#fafafa',
    textMuted: '#a1a1aa',
    bgGradStart: 'from-zinc-900',
    bgGradEnd: 'to-zinc-950',
  },
};

export const getParametricPositions = (
  P: number,
  action: string
): {
  ball: { x: number; y: number; z: number; state: string; rotation: number };
  players: { x: number; y: number; z: number; state: string }[];
} => {
  // Initial standard coordinates
  const leftHitter = { x: -160, y: 0, z: 0, state: 'idle' };
  const leftSetter = { x: -40, y: 0, z: -20, state: 'idle' };
  const rightDefender = { x: 130, y: 0, z: 10, state: 'idle' };
  const rightSetter = { x: 50, y: 0, z: -10, state: 'idle' };
  const ball = { x: -160, y: 15, z: 0, state: 'idle', rotation: P * 0.15 };

  if (action === 'serve') {
    if (P < 15) {
      // Phase A: Prep & Run-up (0% to 15%)
      const t = P / 15;
      leftHitter.x = -160 + 25 * t;
      leftHitter.y = 0 + 15 * t;
      leftHitter.state = 'preparing';

      ball.x = leftHitter.x + 2;
      ball.y = leftHitter.y + 12;
      ball.z = leftHitter.z;
      ball.state = 'idle';
    } else if (P < 35) {
      // Phase B: Ball Toss & Jump (15% to 35%)
      const t = (P - 15) / 20;
      leftHitter.x = -135 + 15 * t;
      leftHitter.y = 15 + 15 * t;
      leftHitter.state = 'jumping';

      ball.x = -135 + 15 * t;
      ball.y = 27 + 25 * t - 15 * t * t;
      ball.z = 0;
      ball.state = 'tossed';

      rightDefender.x = 130 - 10 * t;
    } else if (P < 80) {
      // Phase C: Ball Flight over the net (35% to 80%)
      const t = (P - 35) / 45;
      
      // Server lands
      const tLand = Math.min(1, (P - 35) / 15);
      leftHitter.x = -120 - 25 * tLand;
      leftHitter.y = 30 - 30 * tLand;
      leftHitter.state = P < 50 ? 'hitting' : 'landing';

      ball.x = -120 + 240 * t;
      ball.y = 37 - 2 * t - 32 * t * t;
      ball.z = 5 * Math.sin(Math.PI * t);
      ball.state = 'flying';

      rightDefender.x = 120 + 15 * t;
    } else {
      // Phase D: Floor Impact & Bounce (80% to 100%)
      const t = (P - 80) / 20;
      leftHitter.x = -145;
      leftHitter.y = 0;
      leftHitter.state = 'idle';

      ball.x = 120 + 25 * t;
      ball.y = Math.abs(12 * Math.sin(Math.PI * t));
      ball.z = 5 + 5 * t;
      ball.state = 'grounded';

      rightDefender.x = 135;
      rightDefender.state = 'digging'; // Reaction / Dove but missed
    }
  }

  else if (action === 'spike') {
    leftHitter.x = -110; leftHitter.y = 0; leftHitter.z = -10;
    leftSetter.x = -40; leftSetter.y = 0; leftSetter.z = -20;

    if (P < 25) {
      // Phase A: Setter sets high, Spiker runs in (0% to 25%)
      const t = P / 25;
      leftSetter.state = P < 10 ? 'hitting' : 'idle';
      
      ball.x = -40 + 20 * t;
      ball.y = 15 + 45 * t - 20 * t * t;
      ball.z = -20 + 10 * t;
      ball.state = 'tossed';

      leftHitter.x = -110 + 75 * t;
      leftHitter.state = 'preparing';
    } else if (P < 35) {
      // Phase B: Spiker jumps & cocks arm (25% to 35%)
      const t = (P - 25) / 10;
      leftHitter.x = -35 + 15 * t;
      leftHitter.y = 42 * Math.sin(Math.PI / 2 * t);
      leftHitter.state = 'jumping';

      ball.x = -20 + 5 * t;
      ball.y = 40 + 5 * t - 5 * t * t;
      ball.z = -10;
      ball.state = 'tossed';
    } else if (P < 70) {
      // Phase C: Spiked downwards (35% to 70%)
      const t = (P - 35) / 35;
      
      // Spiker lands
      const tLand = Math.min(1, (P - 35) / 20);
      leftHitter.x = -20 - 30 * tLand;
      leftHitter.y = 42 - 42 * tLand;
      leftHitter.state = P < 45 ? 'hitting' : 'landing';

      ball.x = -15 + 115 * t;
      ball.y = 45 - 45 * t * t;
      ball.z = -10 + 20 * t;
      ball.state = 'spiked';

      // Defender dives
      rightDefender.x = 130 - 35 * t;
      rightDefender.state = 'digging';
    } else {
      // Phase D: Rebound (70% to 100%)
      const t = (P - 70) / 30;
      leftHitter.x = -50; leftHitter.y = 0; leftHitter.state = 'idle';

      ball.x = 100 + 40 * t;
      ball.y = Math.abs(25 * Math.sin(Math.PI * t));
      ball.z = 10 + 10 * t;
      ball.state = 'grounded';

      rightDefender.x = 95;
      rightDefender.state = 'digging';
    }
  }

  else if (action === 'set-spike') {
    leftHitter.x = -100; leftHitter.y = 0; leftHitter.z = -10;
    leftSetter.x = -40; leftSetter.y = 0; leftSetter.z = -20;

    if (P < 25) {
      // Phase A: Ball arrives to Setter (0% to 25%)
      const t = P / 25;
      ball.x = -160 + 120 * t;
      ball.y = 100 - 80 * t;
      ball.z = 20 - 40 * t;
      ball.state = 'flying';

      leftSetter.state = 'preparing';
      leftSetter.x = -40;
    } else if (P < 50) {
      // Phase B: Setter Sets high, Spiker runs up (25% to 50%)
      const t = (P - 25) / 25;
      leftSetter.state = P < 35 ? 'hitting' : 'idle';

      ball.x = -40 + 25 * t;
      ball.y = 20 + 50 * t - 25 * t * t;
      ball.z = -20 + 10 * t;
      ball.state = 'tossed';

      leftHitter.x = -100 + 85 * t;
      // Jump near the end of phase
      if (P > 40) {
        const tJump = (P - 40) / 10;
        leftHitter.y = 42 * tJump;
        leftHitter.state = 'jumping';
      } else {
        leftHitter.state = 'preparing';
      }
    } else if (P < 75) {
      // Phase C: Spiker spikes ball (50% to 75%)
      const t = (P - 50) / 25;
      
      // Spiker lands
      const tLand = Math.min(1, (P - 50) / 15);
      leftHitter.x = -15 - 45 * tLand;
      leftHitter.y = 42 - 42 * tLand;
      leftHitter.state = P < 60 ? 'hitting' : 'landing';

      ball.x = -15 + 125 * t;
      ball.y = 45 - 45 * t * t;
      ball.z = -10 + 20 * t;
      ball.state = 'spiked';
    } else {
      // Phase D: Rebound (75% to 100%)
      const t = (P - 75) / 25;
      leftHitter.x = -60; leftHitter.y = 0; leftHitter.state = 'idle';
      leftSetter.state = 'idle';

      ball.x = 110 + 30 * t;
      ball.y = Math.abs(15 * Math.sin(Math.PI * t));
      ball.z = 10 + 10 * t;
      ball.state = 'grounded';
    }
  }

  else if (action === 'dig-set-spike') {
    leftHitter.x = -160; leftHitter.y = 0; leftHitter.z = 0;
    leftSetter.x = -40; leftSetter.y = 0; leftSetter.z = -20;
    rightDefender.x = 130; rightDefender.y = 0; rightDefender.z = 10;
    rightSetter.x = 50; rightSetter.y = 0; rightSetter.z = -10;

    if (P < 25) {
      // Phase A: Deep serve arrival to RightDefender (0% to 25%)
      const t = P / 25;
      ball.x = -180 + 290 * t;
      ball.y = 90 - 75 * t;
      ball.z = -10 + 20 * t;
      ball.state = 'flying';

      rightDefender.x = 130 - 20 * t;
      rightDefender.state = 'preparing';
    } else if (P < 50) {
      // Phase B: Defender's dig up high to Setter (25% to 50%)
      const t = (P - 25) / 25;
      rightDefender.state = 'digging';

      ball.x = 110 - 60 * t;
      ball.y = 15 + 40 * t - 30 * t * t;
      ball.z = 10 - 20 * t;
      ball.state = 'received';

      rightSetter.x = 50;
      rightSetter.state = 'preparing';
    } else if (P < 70) {
      // Phase C: Setter Sets high, Defender runs up to spike (50% to 70%)
      const t = (P - 50) / 20;
      rightSetter.state = P < 58 ? 'hitting' : 'idle';

      ball.x = 50 + 10 * t;
      ball.y = 25 + 25 * t - 15 * t * t;
      ball.z = -10 + 20 * t;
      ball.state = 'tossed';

      rightDefender.x = 110 - 50 * t;
      if (P > 62) {
        const tJump = (P - 62) / 8;
        rightDefender.y = 40 * tJump;
        rightDefender.state = 'jumping';
      } else {
        rightDefender.state = 'preparing';
      }
    } else if (P < 85) {
      // Phase D: Attacker spikes ball over net to left side floor (70% to 85%)
      const t = (P - 70) / 15;
      
      // Defender lands
      const tLand = Math.min(1, (P - 70) / 10);
      rightDefender.x = 60 + 70 * tLand;
      rightDefender.y = 40 - 40 * tLand;
      rightDefender.state = P < 78 ? 'hitting' : 'landing';

      ball.x = 60 - 160 * t;
      ball.y = 35 - 35 * t * t;
      ball.z = 10 - 20 * t;
      ball.state = 'spiked';

      // Left Server dives to dig
      leftHitter.x = -160 + 40 * t;
      leftHitter.state = 'digging';
    } else {
      // Phase E: Floor hit & rebound on left side (85% to 100%)
      const t = (P - 85) / 15;
      rightDefender.x = 130; rightDefender.y = 0; rightDefender.state = 'idle';
      rightSetter.state = 'idle';
      leftHitter.x = -120;
      leftHitter.state = 'digging';

      ball.x = -100 - 20 * t;
      ball.y = Math.abs(12 * Math.sin(Math.PI * t));
      ball.z = -10 - 5 * t;
      ball.state = 'grounded';
    }
  }

  return {
    ball,
    players: [leftHitter, leftSetter, rightDefender, rightSetter],
  };
};

export const CanvasPreloader: React.FC<CanvasPreloaderProps> = ({
  config,
  progressOverride,
  onComplete,
  showOverlayUI = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(0);
  const lastProgressRef = useRef(0);
  const soundTriggersRef = useRef<Record<string, boolean>>({});
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing Systems...');

  // Setup refs to keep loop values stable without recreating intervals
  const animationFrameRef = useRef<number | null>(null);
  const stateRef = useRef<{
    ball: BallState;
    players: PlayerNode[];
    particles: Particle[];
    timer: number;
    actionProgress: number; // 0 to 1 loop progress
    currentPhase: 'serve' | 'spike' | 'set' | 'dig' | 'done';
    isInitialRun: boolean;
    lastTime: number;
  }>({
    ball: { x: -160, y: 15, z: 0, vx: 0, vy: 0, vz: 0, radius: 10, rotation: 0, spinRate: 0.1, state: 'idle' },
    players: [],
    particles: [],
    timer: 0,
    actionProgress: 0,
    currentPhase: 'serve',
    isInitialRun: true,
    lastTime: 0,
  });

  const colors = THEME_PALETTES[config.theme];

  // Sync sound controls
  useEffect(() => {
    soundManager.setVolume(config.soundVolume);
    soundManager.setEnabled(config.soundEnabled);
  }, [config.soundVolume, config.soundEnabled]);

  // Loading progress generator (simulated if progressOverride is not provided)
  useEffect(() => {
    if (progressOverride !== undefined) {
      setLoadingProgress(progressOverride);
      progressRef.current = progressOverride;
      updateStatusMessage(progressOverride);
      if (progressOverride >= 100) {
        soundManager.playSuccessDing();
        if (onComplete) onComplete();
      }
      return;
    }

    setLoadingProgress(0);
    progressRef.current = 0;
    let startTimestamp: number | null = null;
    const duration = config.loadingDuration;

    const simulateLoading = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(100, (elapsed / duration) * 100);

      setLoadingProgress(progress);
      progressRef.current = progress;
      updateStatusMessage(progress);

      if (progress < 100) {
        animationFrameRef.current = requestAnimationFrame(simulateLoading);
      } else {
        soundManager.playSuccessDing();
        if (onComplete) {
          setTimeout(onComplete, 400);
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(simulateLoading);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [config.loadingDuration, progressOverride, config.action]);

  const updateStatusMessage = (progress: number) => {
    if (progress < 15) {
      setStatusMessage('Warming up court servers...');
    } else if (progress < 30) {
      setStatusMessage('Inflating ball physics engines...');
    } else if (progress < 50) {
      setStatusMessage('Syncing team defense arrays...');
    } else if (progress < 70) {
      setStatusMessage('Optimizing setter-spiker protocols...');
    } else if (progress < 85) {
      setStatusMessage('Powering up high-altitude vertical jump...');
    } else if (progress < 98) {
      setStatusMessage('Executing terminal spike sequence...');
    } else {
      setStatusMessage('Preloader fully stabilized! Ready.');
    }
  };

  // Resize handler
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(300, width),
          height: Math.max(250, height),
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Set up the players based on the action
  const resetSimulation = () => {
    const s = stateRef.current;
    s.particles = [];
    s.actionProgress = 0;
    s.timer = 0;

    // Standard positions: Team A is Left, Team B is Right
    s.players = [
      // Left Server / Spiker
      {
        name: 'LeftHitter',
        x: -160,
        y: 0,
        z: 0,
        targetX: -160,
        targetY: 0,
        targetZ: 0,
        state: 'idle',
        phase: 0,
      },
      // Left Setter (for combos)
      {
        name: 'LeftSetter',
        x: -40,
        y: 0,
        z: -20,
        targetX: -40,
        targetY: 0,
        targetZ: -20,
        state: 'idle',
        phase: Math.PI / 4,
      },
      // Right Defender
      {
        name: 'RightDefender',
        x: 130,
        y: 0,
        z: 10,
        targetX: 130,
        targetY: 0,
        targetZ: 10,
        state: 'idle',
        phase: Math.PI / 2,
      },
      // Right Setter
      {
        name: 'RightSetter',
        x: 50,
        y: 0,
        z: -10,
        targetX: 50,
        targetY: 0,
        targetZ: -10,
        state: 'idle',
        phase: Math.PI,
      },
    ];

    // Configure the ball and player states based on action
    if (config.action === 'serve') {
      s.ball = {
        x: -160,
        y: 12,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        radius: 7,
        rotation: 0,
        spinRate: 0,
        state: 'idle',
      };
      s.players[0].state = 'preparing'; // Server starts preparing
    } else if (config.action === 'spike') {
      // Spike starts with setter tossing the ball high
      s.ball = {
        x: -40,
        y: 20,
        z: -20,
        vx: 5,
        vy: 16,
        vz: 1,
        radius: 7,
        rotation: 0,
        spinRate: 0.05,
        state: 'tossed',
      };
      s.players[1].state = 'hitting'; // Setter just set
      s.players[0].state = 'preparing'; // Spiker runs in
      s.players[0].x = -110;
      s.players[0].targetX = -30; // Runs to spike position
    } else if (config.action === 'set-spike') {
      // Set Spike starts with ball arriving from backcourt
      s.ball = {
        x: -160,
        y: 100,
        z: 20,
        vx: 12,
        vy: -4,
        vz: -2,
        radius: 7,
        rotation: 0,
        spinRate: -0.05,
        state: 'flying',
      };
      s.players[1].state = 'idle';
      s.players[0].state = 'idle';
    } else if (config.action === 'dig-set-spike') {
      // Ball starts from a deep serve by Left side
      s.ball = {
        x: -180,
        y: 90,
        z: -10,
        vx: 15,
        vy: 0,
        vz: 1,
        radius: 7,
        rotation: 0,
        spinRate: 0.08,
        state: 'flying',
      };
    }
  };

  // Trigger reset on config actions
  useEffect(() => {
    resetSimulation();
  }, [config.action, config.theme]);

  // Main canvas drawing and physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    const state = stateRef.current;
    state.lastTime = performance.now();

    const drawLoop = (now: number) => {
      if (!isRunning) return;

      const dt = Math.min(30, now - state.lastTime) * 0.06 * config.speed;
      state.lastTime = now;

      // Clear Canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // 2.5D projection configuration
      const project = (x: number, y: number, z: number) => {
        const cx = dimensions.width / 2;
        const cy = dimensions.height * 0.65;
        const scale = 250 / (250 + z); // Perspective factor based on depth z
        const px = cx + x * scale;
        const py = cy - y * scale + z * 0.45 * scale;
        return { x: px, y: py, scale };
      };

      // Draw background / grid or court floor
      drawCourt(ctx, dimensions, colors, project);

      // Draw trajectory of the ball mapped to progress
      drawTrajectory(ctx, progressRef.current, config.action, colors, project);

      // Handle custom physics and player animation phases
      updatePhysics(dt, state, config);

      // Draw shadow projections first (for depth)
      drawShadows(ctx, state, project, colors);

      // Draw futuristic progress circle under the ball
      drawProgressRing(ctx, state.ball, progressRef.current, colors, project);

      // Draw court net
      drawNet(ctx, dimensions, colors, project);

      // Draw players
      drawPlayers(ctx, state.players, project, colors);

      // Draw ball trails & particles
      drawParticles(ctx, state.particles, project);

      // Draw ball
      drawBall(ctx, state.ball, project, colors);

      // Request next frame
      animationFrameRef.current = requestAnimationFrame(drawLoop);
    };

    animationFrameRef.current = requestAnimationFrame(drawLoop);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions, colors, config.speed, config.gravity, config.particleDensity]);

  const drawTrajectory = (
    ctx: CanvasRenderingContext2D,
    progress: number,
    action: string,
    colors: ThemeColors,
    project: (x: number, y: number, z: number) => { x: number; y: number; scale: number }
  ) => {
    ctx.save();
    
    // Compile trajectory points
    const points: { x: number; y: number; scale: number; p: number }[] = [];
    for (let p = 0; p <= 100; p += 2) {
      const pos = getParametricPositions(p, action);
      const proj = project(pos.ball.x, pos.ball.y, pos.ball.z);
      points.push({ ...proj, p });
    }

    // 1. Draw future path (dashed, semi-transparent)
    ctx.strokeStyle = colors.primary + '25';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    if (points.length > 0) {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    }
    ctx.stroke();

    // 2. Draw completed path (solid, glowing primary gradient)
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.setLineDash([]); // Reset dash
    
    // Create a slight drop shadow glow on the completed path
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    let started = false;
    for (let i = 0; i < points.length; i++) {
      if (points[i].p <= progress) {
        if (!started) {
          ctx.moveTo(points[i].x, points[i].y);
          started = true;
        } else {
          ctx.lineTo(points[i].x, points[i].y);
        }
      }
    }
    if (started) {
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawProgressRing = (
    ctx: CanvasRenderingContext2D,
    ball: BallState,
    progress: number,
    colors: ThemeColors,
    project: (x: number, y: number, z: number) => { x: number; y: number; scale: number }
  ) => {
    if (ball.state === 'idle' && ball.y <= ball.radius + 1) return;

    const floorProj = project(ball.x, 0, ball.z);
    const rad = 24 * floorProj.scale; // fixed visual radius for progress ring on floor
    
    ctx.save();
    
    // Draw background track ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(floorProj.x, floorProj.y, rad, rad * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Draw active progress arc (projected ellipse sector)
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 6;
    
    ctx.beginPath();
    // We draw an ellipse segment representing progress
    const endAngle = (progress / 100) * Math.PI * 2 - Math.PI / 2;
    ctx.ellipse(floorProj.x, floorProj.y, rad, rad * 0.45, 0, -Math.PI / 2, endAngle, false);
    ctx.stroke();

    // Draw tiny futuristic text inside/near the ring
    ctx.shadowBlur = 0; // disable shadow for text
    ctx.fillStyle = colors.primary;
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Floating percentage text above the shadow or below the shadow
    ctx.fillText(`${Math.round(progress)}%`, floorProj.x, floorProj.y + rad * 0.65 + 10);
    
    ctx.restore();
  };

  // Handle game/preloader physics update
  const updatePhysics = (dt: number, state: any, config: PreloaderConfig) => {
    state.timer += dt;
    const ball = state.ball;
    const players = state.players;
    const particles = state.particles as Particle[];

    // --- Particle Lifecycle ---
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt - 0.1 * dt; // gravity for particles
      p.z += p.vz * dt;
      p.life += dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
      }
    }

    // Add general spinning motion trail for ball
    if (ball.state !== 'idle' && Math.random() < 0.4 * config.particleDensity * 0.02) {
      particles.push({
        x: ball.x + (Math.random() - 0.5) * 4,
        y: ball.y + (Math.random() - 0.5) * 4,
        z: ball.z + (Math.random() - 0.5) * 4,
        vx: ball.vx * -0.1 + (Math.random() - 0.5) * 0.5,
        vy: ball.vy * -0.1 + (Math.random() - 0.5) * 0.5,
        vz: ball.vz * -0.1 + (Math.random() - 0.5) * 0.5,
        color: colors.primary,
        size: Math.random() * 2 + 1,
        alpha: 0.8,
        life: 0,
        maxLife: 15,
        type: 'trail',
      });
    }

    const progress = progressRef.current;
    
    // Check reset / loop
    if (progress < lastProgressRef.current || progress < 1) {
      soundTriggersRef.current = {};
    }
    lastProgressRef.current = progress;

    const triggerSound = (key: string, fn: () => void) => {
      if (!soundTriggersRef.current[key]) {
        soundTriggersRef.current[key] = true;
        fn();
      }
    };

    // Calculate parametric positions
    const param = getParametricPositions(progress, config.action);

    // Sync state ball
    ball.x = param.ball.x;
    ball.y = param.ball.y;
    ball.z = param.ball.z;
    ball.state = param.ball.state;
    ball.rotation = param.ball.rotation;

    // Sync state players
    param.players.forEach((p, idx) => {
      if (players[idx]) {
        players[idx].x = p.x;
        players[idx].y = p.y;
        players[idx].z = p.z;
        players[idx].state = p.state;
        players[idx].phase += 0.08 * dt; // continue standard bounce animation phase
      }
    });

    // --- Sound and Spark Triggering ---
    if (config.action === 'serve') {
      if (progress >= 15) {
        triggerSound('serve_toss', () => {
          soundManager.playSqueak();
        });
      }
      if (progress >= 35) {
        triggerSound('serve_hit', () => {
          soundManager.playBallSmack();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.secondary, 'spark');
        });
      }
      if (progress >= 80) {
        triggerSound('serve_land', () => {
          soundManager.playBallSmack();
          soundManager.playCheer();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.primary, config.theme === 'beach-sunset' ? 'sand' : 'impact');
        });
      }
    } else if (config.action === 'spike') {
      if (progress >= 25) {
        triggerSound('spike_squeak', () => {
          soundManager.playSqueak();
        });
      }
      if (progress >= 35) {
        triggerSound('spike_hit', () => {
          soundManager.playBallSmack();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.secondary, 'spark');
        });
      }
      if (progress >= 70) {
        triggerSound('spike_land', () => {
          soundManager.playBallSmack();
          soundManager.playCheer();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.primary, 'impact');
        });
      }
    } else if (config.action === 'set-spike') {
      if (progress >= 25) {
        triggerSound('set_contact', () => {
          soundManager.playBallSmack();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.primary, 'spark');
        });
      }
      if (progress >= 50) {
        triggerSound('set_spike_hit', () => {
          soundManager.playBallSmack();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.secondary, 'spark');
        });
      }
      if (progress >= 75) {
        triggerSound('set_spike_land', () => {
          soundManager.playBallSmack();
          soundManager.playCheer();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.primary, 'impact');
        });
      }
    } else if (config.action === 'dig-set-spike') {
      if (progress >= 25) {
        triggerSound('dig_contact', () => {
          soundManager.playBallSmack();
          soundManager.playSqueak();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.primary, 'spark');
        });
      }
      if (progress >= 50) {
        triggerSound('dig_set_contact', () => {
          soundManager.playBallSmack();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.primary, 'spark');
        });
      }
      if (progress >= 70) {
        triggerSound('dig_spike_hit', () => {
          soundManager.playBallSmack();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.secondary, 'spark');
        });
      }
      if (progress >= 85) {
        triggerSound('dig_spike_land', () => {
          soundManager.playBallSmack();
          soundManager.playCheer();
          spawnExplosion(particles, ball.x, ball.y, ball.z, colors.secondary, 'impact');
        });
      }
    }
  };

  const spawnExplosion = (particles: Particle[], x: number, y: number, z: number, color: string, type: 'trail' | 'impact' | 'sand' | 'spark' | 'confetti') => {
    const count = type === 'impact' ? 25 : 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (type === 'impact' ? 5 : 3) + 1.5;
      particles.push({
        x,
        y,
        z,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
        vy: Math.sin(angle) * speed * 0.8 + (type === 'impact' ? 4 : 2),
        vz: (Math.random() - 0.5) * 3,
        color,
        size: Math.random() * (type === 'impact' ? 3 : 2) + 1,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 20 + 20,
        type,
      });
    }
  };

  // --- Drawing functions ---

  const drawCourt = (
    ctx: CanvasRenderingContext2D,
    dim: { width: number; height: number },
    colors: ThemeColors,
    project: (x: number, y: number, z: number) => { x: number; y: number; scale: number }
  ) => {
    // Fill background gradient (rendered inside Canvas to remain self-contained)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, dim.height);
    bgGrad.addColorStop(0, colors.courtBg);
    bgGrad.addColorStop(1, '#020617'); // Fade to deep space black
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, dim.width, dim.height);

    // Grid details / court polygon
    ctx.strokeStyle = colors.courtLines;
    ctx.lineWidth = 1;

    // Draw the 3D floor boundary (volleyball court is 18m x 9m)
    // We represent this boundary from x = -180 to 180, and z = -80 to 80
    const corners = [
      project(-180, 0, -80), // Back Left
      project(180, 0, -80),  // Back Right
      project(180, 0, 80),   // Front Right
      project(-180, 0, 80),  // Front Left
    ];

    ctx.fillStyle = colors.courtBg + 'ee'; // opacity
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Draw court lines
    ctx.strokeStyle = colors.courtLines;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Center Net Line
    const netCenterLeft = project(0, 0, -80);
    const netCenterRight = project(0, 0, 80);
    ctx.strokeStyle = colors.primary + '66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(netCenterLeft.x, netCenterLeft.y);
    ctx.lineTo(netCenterRight.x, netCenterRight.y);
    ctx.stroke();

    // Attack lines (3m lines) - 60px away from net
    const attackLeftLineFar = project(-60, 0, -80);
    const attackLeftLineNear = project(-60, 0, 80);
    const attackRightLineFar = project(60, 0, -80);
    const attackRightLineNear = project(60, 0, 80);

    ctx.strokeStyle = colors.courtLines + '99';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(attackLeftLineFar.x, attackLeftLineFar.y);
    ctx.lineTo(attackLeftLineNear.x, attackLeftLineNear.y);
    ctx.moveTo(attackRightLineFar.x, attackRightLineFar.y);
    ctx.lineTo(attackRightLineNear.x, attackRightLineNear.y);
    ctx.stroke();
  };

  const drawNet = (
    ctx: CanvasRenderingContext2D,
    _dim: { width: number; height: number },
    colors: ThemeColors,
    project: (x: number, y: number, z: number) => { x: number; y: number; scale: number }
  ) => {
    // Volleyball net height is represented up to y = 52
    const netBottomFar = project(0, 0, -85);
    const netTopFar = project(0, 52, -85);
    const netBottomNear = project(0, 0, 85);
    const netTopNear = project(0, 52, 85);

    // Draw antenna/posts first
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(netBottomFar.x, netBottomFar.y);
    ctx.lineTo(netTopFar.x, netTopFar.y - 12); // Extra post height
    ctx.moveTo(netBottomNear.x, netBottomNear.y);
    ctx.lineTo(netTopNear.x, netTopNear.y - 12);
    ctx.stroke();

    // Red/White Antenna tips
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(netTopFar.x, netTopFar.y - 12);
    ctx.lineTo(netTopFar.x, netTopFar.y - 25);
    ctx.moveTo(netTopNear.x, netTopNear.y - 12);
    ctx.lineTo(netTopNear.x, netTopNear.y - 25);
    ctx.stroke();

    // Draw Net grid / texture
    ctx.fillStyle = colors.net + '22';
    ctx.beginPath();
    ctx.moveTo(netTopFar.x, netTopFar.y);
    ctx.lineTo(netTopNear.x, netTopNear.y);
    ctx.lineTo(netBottomNear.x + (netTopNear.x - netBottomNear.x) * 0.35, netTopNear.y + (netBottomNear.y - netTopNear.y) * 0.35); // Net bottom is higher than court
    ctx.lineTo(netBottomFar.x + (netTopFar.x - netBottomFar.x) * 0.35, netTopFar.y + (netBottomFar.y - netTopFar.y) * 0.35);
    ctx.closePath();
    ctx.fill();

    // Net border bands (top and bottom tape)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(netTopFar.x, netTopFar.y);
    ctx.lineTo(netTopNear.x, netTopNear.y);
    ctx.stroke();

    // Draw cross lines inside the net mesh
    ctx.strokeStyle = colors.net + '77';
    ctx.lineWidth = 0.5;
    const meshCount = 12;
    for (let i = 0; i <= meshCount; i++) {
      const t = i / meshCount;
      const xTop = netTopFar.x + (netTopNear.x - netTopFar.x) * t;
      const yTop = netTopFar.y + (netTopNear.y - netTopFar.y) * t;

      const yBottomLevel = 22; // Net starts around y = 22
      const botFar = project(0, yBottomLevel, -85);
      const botNear = project(0, yBottomLevel, 85);
      const xBot = botFar.x + (botNear.x - botFar.x) * t;
      const yBot = botFar.y + (botNear.y - botFar.y) * t;

      ctx.beginPath();
      ctx.moveTo(xTop, yTop);
      ctx.lineTo(xBot, yBot);
      ctx.stroke();
    }

    // Horizontal mesh lines
    const horizCount = 3;
    for (let i = 1; i < horizCount; i++) {
      const t = i / horizCount;
      const yVal = 22 + (52 - 22) * t;
      const pFar = project(0, yVal, -85);
      const pNear = project(0, yVal, 85);

      ctx.beginPath();
      ctx.moveTo(pFar.x, pFar.y);
      ctx.lineTo(pNear.x, pNear.y);
      ctx.stroke();
    }
  };

  const drawShadows = (
    ctx: CanvasRenderingContext2D,
    state: any,
    project: (x: number, y: number, z: number) => { x: number; y: number; scale: number },
    _colors: ThemeColors
  ) => {
    // Draw ball shadow
    const ball = state.ball;
    if (ball.state !== 'idle') {
      const ballFloor = project(ball.x, 0, ball.z);
      const sizeRatio = Math.max(0.1, 1 - ball.y / 200);
      const shadowRadius = ball.radius * ballFloor.scale * sizeRatio;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(ballFloor.x, ballFloor.y, shadowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw player shadows
    state.players.forEach((p: PlayerNode) => {
      // Don't draw shadows for inactive/off-screen players
      if (p.x < -180 || p.x > 180) return;

      const pFloor = project(p.x, 0, p.z);
      const shadowWidth = 14 * pFloor.scale;
      const shadowHeight = 6 * pFloor.scale;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(pFloor.x, pFloor.y, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const drawPlayers = (
    ctx: CanvasRenderingContext2D,
    players: PlayerNode[],
    project: (x: number, y: number, z: number) => { x: number; y: number; scale: number },
    colors: ThemeColors
  ) => {
    players.forEach((p) => {
      // Hide if off the visual court limits
      if (p.x < -200 || p.x > 200) return;

      const joints = project(p.x, p.y, p.z);
      const sc = joints.scale;

      // Base player design: Silhouette with beautiful action poses
      ctx.save();

      // Team coloring
      const isTeamLeft = p.name.startsWith('Left');
      ctx.fillStyle = isTeamLeft ? colors.primary : colors.secondary;
      ctx.strokeStyle = isTeamLeft ? colors.primary : colors.secondary;

      const wave = Math.sin(p.phase);

      // Procedural posing based on current player state
      if (p.state === 'preparing') {
        // Runner Crouching/Preparing
        // Head
        ctx.beginPath();
        ctx.arc(joints.x, joints.y - 32 * sc, 4.5 * sc, 0, Math.PI * 2);
        ctx.fill();

        // Torso/Spine
        ctx.lineWidth = 3.5 * sc;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(joints.x, joints.y - 28 * sc);
        ctx.lineTo(joints.x - 4 * sc, joints.y - 14 * sc); // leaning forward
        ctx.stroke();

        // Legs
        ctx.lineWidth = 2.5 * sc;
        ctx.beginPath();
        ctx.moveTo(joints.x - 4 * sc, joints.y - 14 * sc);
        ctx.lineTo(joints.x - 12 * sc, joints.y - 6 * sc); // Leg 1 bent back
        ctx.lineTo(joints.x - 10 * sc, joints.y);
        ctx.moveTo(joints.x - 4 * sc, joints.y - 14 * sc);
        ctx.lineTo(joints.x + 2 * sc, joints.y - 4 * sc); // Leg 2 crouched
        ctx.lineTo(joints.x + 4 * sc, joints.y);
        ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(joints.x - 2 * sc, joints.y - 26 * sc);
        ctx.lineTo(joints.x - 14 * sc, joints.y - 20 * sc); // swing back
        ctx.stroke();
      }

      else if (p.state === 'jumping' || p.state === 'hitting') {
        // High-altitude flight / strike pose!

        // Head
        ctx.beginPath();
        ctx.arc(joints.x + 2 * sc, joints.y - 34 * sc, 4.5 * sc, 0, Math.PI * 2);
        ctx.fill();

        // Torso (arched back)
        ctx.lineWidth = 4 * sc;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(joints.x + 2 * sc, joints.y - 30 * sc);
        ctx.lineTo(joints.x - 3 * sc, joints.y - 15 * sc);
        ctx.stroke();

        // Legs (tucked/bent in jump)
        ctx.lineWidth = 2.5 * sc;
        ctx.beginPath();
        ctx.moveTo(joints.x - 3 * sc, joints.y - 15 * sc);
        ctx.lineTo(joints.x - 10 * sc, joints.y - 5 * sc); // Knee bent up
        ctx.lineTo(joints.x - 4 * sc, joints.y + 2 * sc);
        ctx.moveTo(joints.x - 3 * sc, joints.y - 15 * sc);
        ctx.lineTo(joints.x - 12 * sc, joints.y - 10 * sc); // Knee bent back
        ctx.lineTo(joints.x - 14 * sc, joints.y - 2 * sc);
        ctx.stroke();

        // Arm 1 (The spiking arm - dynamic strike!)
        ctx.lineWidth = 2.8 * sc;
        ctx.beginPath();
        ctx.moveTo(joints.x + 1 * sc, joints.y - 28 * sc);
        if (p.state === 'hitting') {
          // Whipping forward
          ctx.lineTo(joints.x + 10 * sc, joints.y - 38 * sc);
          ctx.lineTo(joints.x + 18 * sc, joints.y - 28 * sc);
        } else {
          // Cocked back
          ctx.lineTo(joints.x - 6 * sc, joints.y - 36 * sc);
          ctx.lineTo(joints.x - 12 * sc, joints.y - 28 * sc);
        }
        ctx.stroke();

        // Arm 2 (Guide arm pointing up)
        ctx.beginPath();
        ctx.moveTo(joints.x + 2 * sc, joints.y - 28 * sc);
        ctx.lineTo(joints.x + 12 * sc, joints.y - 32 * sc);
        ctx.stroke();
      }

      else if (p.state === 'digging') {
        // Low defender dig / dive!
        // Head
        ctx.beginPath();
        ctx.arc(joints.x + 8 * sc, joints.y - 18 * sc, 4.5 * sc, 0, Math.PI * 2);
        ctx.fill();

        // Torso (extremely horizontal leaning forward)
        ctx.lineWidth = 4 * sc;
        ctx.beginPath();
        ctx.moveTo(joints.x + 8 * sc, joints.y - 15 * sc);
        ctx.lineTo(joints.x - 4 * sc, joints.y - 8 * sc);
        ctx.stroke();

        // Legs (deep splits / low lunge)
        ctx.lineWidth = 2.5 * sc;
        ctx.beginPath();
        ctx.moveTo(joints.x - 4 * sc, joints.y - 8 * sc);
        ctx.lineTo(joints.x - 16 * sc, joints.y - 4 * sc); // leg back
        ctx.lineTo(joints.x - 18 * sc, joints.y);
        ctx.moveTo(joints.x - 4 * sc, joints.y - 8 * sc);
        ctx.lineTo(joints.x + 4 * sc, joints.y - 3 * sc);  // leg front
        ctx.lineTo(joints.x + 8 * sc, joints.y);
        ctx.stroke();

        // Classed dig arms pointing forward like a board
        ctx.lineWidth = 3 * sc;
        ctx.beginPath();
        ctx.moveTo(joints.x + 6 * sc, joints.y - 13 * sc);
        ctx.lineTo(joints.x + 18 * sc, joints.y - 10 * sc); // Bump board
        ctx.stroke();
      }

      else {
        // Idle/Running Bounce (Standing, ready position)
        // Head
        ctx.beginPath();
        ctx.arc(joints.x, joints.y - 32 * sc + wave * 0.8 * sc, 4.5 * sc, 0, Math.PI * 2);
        ctx.fill();

        // Torso
        ctx.lineWidth = 4 * sc;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(joints.x, joints.y - 28 * sc + wave * 0.8 * sc);
        ctx.lineTo(joints.x, joints.y - 14 * sc);
        ctx.stroke();

        // Legs
        ctx.lineWidth = 2.8 * sc;
        ctx.beginPath();
        ctx.moveTo(joints.x, joints.y - 14 * sc);
        ctx.lineTo(joints.x - 5 * sc, joints.y - 6 * sc); // Leg 1
        ctx.lineTo(joints.x - 5 * sc + wave * 0.5 * sc, joints.y);
        ctx.moveTo(joints.x, joints.y - 14 * sc);
        ctx.lineTo(joints.x + 5 * sc, joints.y - 6 * sc); // Leg 2
        ctx.lineTo(joints.x + 5 * sc - wave * 0.5 * sc, joints.y);
        ctx.stroke();

        // Clasp arms (resting forward)
        ctx.lineWidth = 2.5 * sc;
        ctx.beginPath();
        ctx.moveTo(joints.x, joints.y - 25 * sc + wave * 0.8 * sc);
        ctx.lineTo(joints.x + 6 * sc, joints.y - 18 * sc);
        ctx.lineTo(joints.x + 3 * sc, joints.y - 12 * sc);
        ctx.stroke();
      }

      ctx.restore();
    });
  };

  const drawBall = (
    ctx: CanvasRenderingContext2D,
    ball: BallState,
    project: (x: number, y: number, z: number) => { x: number; y: number; scale: number },
    colors: ThemeColors
  ) => {
    if (ball.state === 'idle' && ball.y <= ball.radius + 1) return; // Ball is hidden in hand if server ready

    const b = project(ball.x, ball.y, ball.z);
    const rad = ball.radius * b.scale;

    ctx.save();

    // Shadow sphere gradient
    const grad = ctx.createRadialGradient(
      b.x - rad * 0.3,
      b.y - rad * 0.3,
      rad * 0.1,
      b.x,
      b.y,
      rad
    );
    grad.addColorStop(0, colors.ballPrimary);
    grad.addColorStop(0.7, colors.ballSecondary);
    grad.addColorStop(1, '#000000'); // Shadow rim

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, rad, 0, Math.PI * 2);
    ctx.fill();

    // Draw standard volleyball panels/seams
    ctx.strokeStyle = '#00000033';
    ctx.lineWidth = 1 * b.scale;
    ctx.beginPath();
    
    // Panel seam 1
    ctx.arc(b.x, b.y, rad, ball.rotation, ball.rotation + Math.PI, false);
    // Cross panel seam
    ctx.moveTo(b.x - rad * Math.cos(ball.rotation), b.y - rad * Math.sin(ball.rotation));
    ctx.quadraticCurveTo(
      b.x + rad * 0.5 * Math.sin(ball.rotation),
      b.y - rad * 0.5 * Math.cos(ball.rotation),
      b.x + rad * Math.cos(ball.rotation),
      b.y + rad * Math.sin(ball.rotation)
    );
    ctx.stroke();

    // Highlight sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.ellipse(b.x - rad * 0.3, b.y - rad * 0.3, rad * 0.4, rad * 0.2, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawParticles = (
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    project: (x: number, y: number, z: number) => { x: number; y: number; scale: number }
  ) => {
    particles.forEach((p) => {
      const pt = project(p.x, p.y, p.z);
      const size = p.size * pt.scale;

      ctx.save();
      ctx.globalAlpha = p.alpha;

      if (p.type === 'trail') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        // Sharp star/cross lines
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pt.x - size * 2, pt.y);
        ctx.lineTo(pt.x + size * 2, pt.y);
        ctx.moveTo(pt.x, pt.y - size * 2);
        ctx.lineTo(pt.x, pt.y + size * 2);
        ctx.stroke();
      } else {
        // Sand / Impact particles
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, size * (1.5 - p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  };

  return (
    <div
      ref={containerRef}
      id="volleyball-preloader-container"
      className="relative w-full h-full min-h-[300px] flex flex-col justify-center items-center overflow-hidden rounded-2xl select-none"
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full block"
      />

      {/* Loading Overlay UI elements */}
      {showOverlayUI && (
      <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col items-center pointer-events-none">
        {/* Welcome message with glowing fade */}
        <div className="text-center mb-3">
          {config.showCustomWelcome ? (
            <h3 className="text-lg md:text-xl font-bold font-sans tracking-wide text-white drop-shadow-md animate-pulse">
              {config.customWelcomeText.replace('{name}', config.welcomeName || 'Athlete')}
            </h3>
          ) : (
            <h3 className="text-lg md:text-xl font-bold font-sans tracking-wide text-white drop-shadow-md">
              Welcome back, <span className="text-yellow-400">{config.welcomeName || 'Athlete'}</span>!
            </h3>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-sm h-1.5 bg-slate-800/80 rounded-full overflow-hidden p-[1px] border border-slate-700/50 backdrop-blur-sm">
          <div
            className={`h-full bg-gradient-to-r from-yellow-400 via-amber-400 to-indigo-500 rounded-full transition-all duration-300 ease-out`}
            style={{ width: `${loadingProgress}%` }}
          />
        </div>

        {/* Progress percent & status subtitle */}
        <div className="flex w-full max-w-sm justify-between items-center mt-2 text-xs font-mono px-1">
          <span className="text-slate-400 select-none">{statusMessage}</span>
          <span className="text-yellow-400 font-bold tracking-wider">{Math.round(loadingProgress)}%</span>
        </div>
      </div>
      )}

      {/* Aesthetic Top Corner Logo/Indicator */}
      {showOverlayUI && (
      <div className="absolute top-4 left-4 p-2 bg-slate-900/40 backdrop-blur-md rounded-lg border border-white/5 pointer-events-none">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
            V-SYSTEM LIVE
          </span>
        </div>
      </div>
      )}
    </div>
  );
};
