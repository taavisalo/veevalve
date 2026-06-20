import type { Config } from 'tailwindcss';

export const tailwindPreset: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        accentDark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        qualityGood: 'rgb(var(--color-quality-good) / <alpha-value>)',
        qualityBad: 'rgb(var(--color-quality-bad) / <alpha-value>)',
        qualityUnknown: 'rgb(var(--color-quality-unknown) / <alpha-value>)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
};

export default tailwindPreset;
