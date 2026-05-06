{
  "target": "mcmcp.my-monkey.fr",
  "source": "./",
  "exclude": ["node_modules", ".env", ".git"],
  "build_command": "pnpm build",
  "nodejs_app": "mcmcp",
  "setup": {
    "nodejs_version": "22.22.2",
    "app_path": "mcmcp.my-monkey.fr",
    "deployment_mode": "production",
    "base_uri": "/",
    "startup_file": "server.js"
  },
  "post_deploy": "mkdir -p tmp && touch tmp/restart.txt",
  "sitemap": { "enabled": true },
  "robots": { "enabled": true }
}
