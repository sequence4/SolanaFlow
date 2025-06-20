/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",

  /* Scan every place where .tsx files live */
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",      // Next-13/14 App Router files
    "./pages/**/*.{js,ts,jsx,tsx}",    // classic pages (if any)
    "./src/**/*.{js,ts,jsx,tsx}",      // SolMintApp + shadcn-ui
    "./components/**/*.{js,ts,jsx,tsx}"
  ],

  theme: { extend: {} },

  plugins: [require("tailwindcss-animate")],

  /* Prevent JIT from stripping dynamic/third-party classes */
  safelist: [
    "scale-[1.02]",
    "blur-3xl",
    "bg-gradient-to-r",
    "from-blue-500",
    "to-purple-500",
    "hover:from-blue-600",
    "hover:to-purple-600",
    "hover:scale-105",
    "shadow-lg"
  ],
};
