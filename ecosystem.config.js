module.exports = {
  apps: [{
    name: 'paint-pizarra',
    script: 'npm',
    args: 'start',
    cwd: '/home/gelt/apps/paint-pizarra',
    env: {
      NODE_ENV: 'production',
      PORT: 3558,
    },
  }],
}
