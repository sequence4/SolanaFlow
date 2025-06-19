/**
 * PostCSS config required by Tailwind when building in CI / Docker.
 * DO NOT remove – the Dockerfile just copies the whole web/ folder,
 * so this file will automatically be present in the final image.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}; 