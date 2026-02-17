import tailwindPreset from '@veevalve/ui/tailwind-preset';

const config = {
  presets: [tailwindPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/web/**/*.{ts,tsx}',
  ],
};

export default config;
