const Neon = {
  cyan: '#00ffff',
  magenta: '#ff00ff',
  yellow: '#ffff00',
  green: '#00ff00',
  blue: '#0000ff',
  red: '#ff0000',
  orange: '#ff8800',
  purple: '#aa00ff',
  white: '#ffffff',
  teal: '#0088ff'
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
  },
  fieldLine: Neon.green
} as const;

