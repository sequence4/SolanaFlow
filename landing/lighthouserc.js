module.exports = {
  ci: {
    collect: {
      url: ['http://127.0.0.1:3000/'],
      numberOfRuns: 1,
      settings: { preset: 'desktop', throttlingMethod: 'provided' }
    },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift':  ['warn',  { maxNumericValue: 0.1 }],
      }
    },
    upload: { target: 'temporary-public-storage' }
  }
}; 