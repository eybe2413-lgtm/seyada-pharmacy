/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0E7C66',
          dark: '#0A5C4C',
          light: '#129A7E',
          soft: '#E6F4F0',
        },
        accent: {
          DEFAULT: '#C9852C',
          soft: '#FBF0DF',
        },
        danger: {
          DEFAULT: '#C0473A',
          soft: '#FBEAE8',
        },
        ink: '#16241F',
        sub: '#62766F',
        line: '#E4EBE8',
        bg: '#F5F8F7',
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
