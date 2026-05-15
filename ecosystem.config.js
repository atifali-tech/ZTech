module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'index.js',
      cwd: './backend',
      watch: false,
    },
    {
      name: 'frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'dev',
      cwd: './frontend',
      watch: false,
    },
  ],
};
