import type { Command } from 'commander';
import { getConfig } from '../lib/config-store.js';

export function startCommand(program: Command): void {
  program
    .command('start')
    .description('Show instructions to start the Wired-In stack')
    .option('--dev', 'Show development mode instructions')
    .action((options: { dev?: boolean }) => {
      const config = getConfig();

      console.log('');

      if (options.dev) {
        console.log('  Wired-In — Development Mode');
        console.log('  ===========================');
        console.log('');
        console.log('  Start the development stack with hot reload:');
        console.log('');
        console.log('    docker compose -f docker-compose.yml -f docker-compose.dev.yml up');
        console.log('');
        console.log('  Or start individual services:');
        console.log('');
        console.log('    # Gateway only');
        console.log('    docker compose up gateway');
        console.log('');
        console.log('    # Frontend with hot reload');
        console.log('    cd frontend && npm run dev');
        console.log('');
        console.log('    # Run tests');
        console.log('    docker compose run --rm gateway npm test');
        console.log('');
      } else {
        console.log('  Wired-In — Start');
        console.log('  ================');
        console.log('');
        console.log('  Start the full Wired-In stack:');
        console.log('');
        console.log('    docker compose up -d');
        console.log('');
        console.log('  Stop the stack:');
        console.log('');
        console.log('    docker compose down');
        console.log('');
        console.log('  View logs:');
        console.log('');
        console.log('    docker compose logs -f');
        console.log('');
      }

      console.log('  Current Configuration');
      console.log('  ---------------------');
      console.log(`  Gateway URL       : ${config.gatewayUrl}`);
      console.log(`  Active Workspace  : ${config.activeWorkspace ?? '(none)'}`);
      console.log(`  API Keys          : ${Object.keys(config.apiKeys).length} configured`);
      console.log('');

      if (Object.keys(config.apiKeys).length === 0) {
        console.log('  Warning: No API keys configured.');
        console.log('  Configure platform keys before starting:');
        console.log('    wiredin platform set-key <platform> <key>');
        console.log('');
      }

      if (!config.activeWorkspace) {
        console.log('  Warning: No active workspace.');
        console.log('  Create a workspace before starting:');
        console.log('    wiredin workspace create <name>');
        console.log('');
      }
    });
}
