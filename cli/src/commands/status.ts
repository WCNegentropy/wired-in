import type { Command } from 'commander';
import { getConfig, getConfigPath } from '../lib/config-store.js';

export function statusCommand(program: Command): void {
  program
    .command('status')
    .description('Show overall system status')
    .action(() => {
      const config = getConfig();

      const activeWs = config.activeWorkspace
        ? config.workspaces.find((w) => w.name === config.activeWorkspace)
        : null;

      const tileCount = activeWs ? activeWs.tiles.length : 0;
      const configuredPlatforms = Object.keys(config.apiKeys);
      const platformDisplay = configuredPlatforms.length > 0
        ? configuredPlatforms.join(', ')
        : '(none)';

      console.log('');
      console.log('  +---------------------------------------------+');
      console.log('  |            Wired-In Status                   |');
      console.log('  +---------------------------------------------+');
      console.log('');
      console.log(`  Active Workspace  : ${config.activeWorkspace ?? '(none)'}`);
      console.log(`  Workspaces        : ${config.workspaces.length} total`);
      console.log(`  Tiles (active)    : ${tileCount}`);
      console.log(`  Gateway URL       : ${config.gatewayUrl}`);
      console.log(`  Theme             : ${config.theme}`);
      console.log(`  Configured APIs   : ${platformDisplay}`);
      console.log(`  Config Path       : ${getConfigPath()}`);
      console.log('');

      if (config.workspaces.length === 0) {
        console.log('  Get started:');
        console.log('    wiredin workspace create my-dashboard');
        console.log('    wiredin platform set-key reddit <your-key>');
        console.log('    wiredin start');
        console.log('');
      }
    });
}
