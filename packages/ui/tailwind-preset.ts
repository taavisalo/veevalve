import type { Config } from 'tailwindcss';

export const tailwindPreset: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        surface: '#F2F7F5',
        card: '#FFFFFF',
        ink: '#153233',
        accent: '#0A8F78',
        accentDark: '#06685A',
        qualityGood: '#1E8A4A',
        qualityBad: '#C33B31',
        qualityUnknown: '#7B8794',
      },
      boxShadow: {
        card: '0 8px 30px -14px rgba(6, 104, 90, 0.25)',
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
};

export default tailwindPreset;
