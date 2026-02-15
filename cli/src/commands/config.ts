import type { Command } from 'commander';
import { getConfig, updateConfig, getDefaultConfig, getConfigPath } from '../lib/config-store.js';

export function configCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Manage Wired-In configuration');

  config
    .command('show')
    .description('Display current configuration')
    .action(() => {
      const cfg = getConfig();

      console.log('');
      console.log('  Wired-In Configuration');
      console.log('  ----------------------');
      console.log('');
      console.log(`  Gateway URL      : ${cfg.gatewayUrl}`);
      console.log(`  Theme            : ${cfg.theme}`);
      console.log(`  Active Workspace : ${cfg.activeWorkspace ?? '(none)'}`);
      console.log(`  Workspaces       : ${cfg.workspaces.length}`);
      console.log(`  API Keys         : ${Object.keys(cfg.apiKeys).length} configured`);
      console.log(`  Config File      : ${getConfigPath()}`);
      console.log('');
    });

  config
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key (gatewayUrl, theme)')
    .argument('<value>', 'Configuration value')
    .action((key: string, value: string) => {
      const allowedKeys = ['gatewayUrl', 'theme'];

      if (!allowedKeys.includes(key)) {
        console.error(`  Error: Unknown configuration key "${key}".`);
        console.error(`  Allowed keys: ${allowedKeys.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      if (key === 'theme' && value !== 'dark' && value !== 'light') {
        console.error('  Error: Theme must be "dark" or "light".');
        process.exitCode = 1;
        return;
      }

      updateConfig({ [key]: value } as any);
      console.log(`  Set ${key} = ${value}`);
    });

  config
    .command('reset')
    .description('Reset configuration to defaults')
    .action(() => {
      const defaults = getDefaultConfig();
      updateConfig(defaults);
      console.log('  Configuration reset to defaults.');
    });

  config
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      console.log(getConfigPath());
    });
}
