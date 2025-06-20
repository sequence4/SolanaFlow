export const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [require("tailwindcss-animate")],
  safelist: [
    "scale-[1.02]",
    "blur-3xl",
  ],
};
`;
