module.exports = {
  apps: [
    {
      name: 'landing',
      cwd: __dirname + '/landing',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'staging'
      }
    }
  ]
};
