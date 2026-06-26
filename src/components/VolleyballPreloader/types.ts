/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VolleyballAction = 'serve' | 'spike' | 'set-spike' | 'dig-set-spike';

export type PreloaderTheme = 'midnight-spike' | 'cyber-court' | 'beach-sunset' | 'olympic-gold' | 'minimal-chalk';

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'trail' | 'impact' | 'sand' | 'spark' | 'confetti';
}

export interface PlayerNode {
  name: string;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  state: 'idle' | 'preparing' | 'jumping' | 'hitting' | 'landing' | 'digging';
  phase: number; // For sine wave animation phases
}

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  rotation: number;
  spinRate: number;
  state: 'tossed' | 'flying' | 'spiked' | 'received' | 'grounded' | 'idle';
}

export interface PreloaderConfig {
  theme: PreloaderTheme;
  action: VolleyballAction;
  speed: number; // 0.5 to 2.0
  gravity: number; // 0.1 to 0.5
  particleDensity: number; // 0 to 100
  soundVolume: number; // 0 to 1
  soundEnabled: boolean;
  welcomeName: string;
  customWelcomeText: string;
  showCustomWelcome: boolean;
  loadingDuration: number; // in ms, e.g. 3000
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  courtBg: string;
  courtLines: string;
  net: string;
  ballPrimary: string;
  ballSecondary: string;
  text: string;
  textMuted: string;
  bgGradStart: string;
  bgGradEnd: string;
}
