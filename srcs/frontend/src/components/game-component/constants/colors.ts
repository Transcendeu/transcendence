const Neon = {
  cyan: '#0ff',
  magenta: '#f0f',
  yellow: '#ff0',
  green: '#0f0',
  blue: '#00f',
  red: '#f00',
  orange: '#f80',
  purple: '#a0f',
  white: '#fff',
  teal: '#08f'
};

export const GameColors = {
  background: 'black',
  glow: Neon.purple,
  paddleColors: [Neon.white, Neon.white, Neon.yellow, Neon.green],
  ball: Neon.white,
  centerLine: Neon.white,
  canvasBorder: `2px solid ${Neon.white}`,
  canvasShadow: `0 0 16px ${Neon.purple}`,
  text: {
    font: 'Orbitron, Arial',
    primary: Neon.white,
    secondary: Neon.red,
  }
} as const;

