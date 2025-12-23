/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Signal states
        'signal-strong-buy': '#00C853',
        'signal-buy': '#69F0AE',
        'signal-neutral': '#9E9E9E',
        'signal-sell': '#FF8A80',
        'signal-strong-sell': '#FF1744',
        // Dark theme
        'dark-bg': '#0a0a0f',
        'dark-card': '#12121a',
        'dark-border': '#1e1e2e',
        'dark-text': '#e0e0e0',
        'dark-muted': '#6b7280',
        // Accent
        'accent-primary': '#8B5CF6',
        'accent-secondary': '#06B6D4',
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(139, 92, 246, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)' },
        },
      },
    },
  },
  plugins: [],
};

