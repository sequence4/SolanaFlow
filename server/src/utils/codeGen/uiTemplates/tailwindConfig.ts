export const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",

  /* 1️⃣  Scan every location where .tsx files live  */
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",      // ↖ Next 13/14 App Router
    "./pages/**/*.{js,ts,jsx,tsx}",    // ↖ fallback if a Pages dir is ever generated
    "./src/**/*.{js,ts,jsx,tsx}",      // ↖ SolMintApp + UI library live here
    "./components/**/*.{js,ts,jsx,tsx}"
  ],

  /* 2️⃣  Extend theme later if you add tokens; empty for now */
  theme: { extend: {} },

  /* 3️⃣  Plugins — keep animate for shadcn-ui motions */
  plugins: [require("tailwindcss-animate")],

  /* 4️⃣  Safelist runtime or 3rd-party classes (wallet btn) */
  safelist: [
    "scale-[1.02]",                     // card hover grow
    "blur-3xl",                         // whimsical blobs
    /* wallet-adapter button gradient + hover zoom */
    "bg-gradient-to-r",
    "from-blue-500",
    "to-purple-500",
    "hover:from-blue-600",
    "hover:to-purple-600",
    "hover:scale-105",
    "shadow-lg"
  ],
};
`;
