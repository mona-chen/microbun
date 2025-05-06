module.exports = {
  apps: [
    {
      name: "carcall",
      script: "main.ts",
      interpreter: "npx",
      interpreter_args: "ts-node",
      env: {
        NODE_ENV: "development"
      },
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
