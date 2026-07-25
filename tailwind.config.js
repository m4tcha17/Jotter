/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './screens/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './navigation/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#000000',
        'surface-soft': '#0d0d0d',
        'surface-card': '#161616',
        'surface-elevated': '#232323',
        ink: '#ffffff',
        body: '#b3b3b3',
        'body-strong': '#e6e6e6',
        muted: '#7a7a7a',
        hairline: '#2a2a2a',
        'hairline-strong': '#3d3d3d',
        primary: '#10b981',
        'primary-strong': '#059669',
        'primary-on': '#03140d',
        destructive: '#ef4444',
        'destructive-strong': '#f87171',
        'calibration-amber': '#f5a623',
        'calibration-green': '#10b981',
        'calibration-cyan': '#22d3ee',
      },
      fontFamily: {
        'inter-black': ['Inter_900Black'],
        'inter-extrabold': ['Inter_800ExtraBold'],
        'inter-bold': ['Inter_700Bold'],
        inter: ['Inter_400Regular'],
        'inter-light': ['Inter_300Light'],
      },
    },
  },
  plugins: [],
};
