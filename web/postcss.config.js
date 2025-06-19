/**
 * PostCSS config required by Tailwind in CI / Docker.
 * Copied verbatim into the final runtime image by the Dockerfile.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}; 