/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: '#F8FAFC',
        card: '#FFFFFF',
        primary: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        tealAccent: {
          DEFAULT: '#0D9488',
          50: '#F0FDFA',
          100: '#CCFBF1',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
        },
        aiAccent: {
          DEFAULT: '#7C3AED',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
        },
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
    },
  },
  plugins: [],
}
