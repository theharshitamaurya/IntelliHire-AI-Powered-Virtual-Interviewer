/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        "3rem": "3rem",
      },
    },
  },
  plugins: [],
};
