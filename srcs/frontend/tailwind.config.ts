module.exports = {
  content: ['./src/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        scanline: 'rgba(255, 0, 128, 0.1)',
        scanOverlay: 'rgba(10, 10, 15, 0.5)',
        neonCyan: '#0ff',
        neonMagenta: '#f0f',
        neonGreen: '#0f0',
        magenta: '#f0f',
      },
      fontFamily: {
        press: ['"Press Start 2P"', 'cursive'],
      },
      letterSpacing: {
        wider4: '4px',
      },
      fontSize: {
        '7xl': '3.5rem',
        lg: '1.5rem',
        xs: '0.8rem',
      },
      maxWidth: {
        '95p': '95%',
      },
      width: {
        '800px': '800px',
        '32px': '32px',
      },
      height: {
        '32px': '32px',
      },
      keyframes: {
        fadeInOut: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '10%': { opacity: '1', transform: 'translateY(0)' },
          '90%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-20px)' },
        },
      },
      animation: {
        fadeInOut: 'fadeInOut 3s ease-in-out',
        hover: 'hover 1s infinite alternate ease-in-out',
        glitch: 'glitch 2s infinite',
      },
    },
  },
  plugins: [],
};
