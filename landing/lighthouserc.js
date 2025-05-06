/** @type {import('@lhci/cli').Config} */
module.exports = {
  ci: {
    collect: {
      url: ['http://127.0.0.1:3000/'],
      numberOfRuns: process.env.NUMBER_OF_RUNS || 3,
      chromePath: process.env.CHROME_PATH || '/snap/bin/chromium',
      chromeFlags:
        '--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu --user-data-dir=./.lighthouseci/tmp',
      settings: { preset: 'desktop', throttlingMethod: 'provided' }
    },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift':  ['warn',  { maxNumericValue: 0.1 }],
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lhci-reports'
    }
  }
}; 