/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontSize: {
        xs: "1.125rem",      // 18px (14.4px * 1.25)
        sm: "1.25rem",       // 20px (16px * 1.25)
        base: "1.25rem",     // 20px (16px * 1.25)
        lg: "1.375rem",      // 22px (17.6px * 1.25)
        xl: "1.5625rem",     // 25px (20px * 1.25)
        "2xl": "1.875rem",   // 30px (24px * 1.25)
        "3xl": "2.1875rem",  // 35px (28px * 1.25)
        "4xl": "2.5rem",     // 40px (32px * 1.25)
        "5xl": "3.125rem",   // 50px (40px * 1.25)
        "6xl": "3.75rem",    // 60px (48px * 1.25)
        "7xl": "4.375rem",   // 70px (56px * 1.25)
        "8xl": "5rem",       // 80px (64px * 1.25)
        "9xl": "6.25rem",    // 100px (80px * 1.25)
      },
    },
  },
  plugins: [],
};
