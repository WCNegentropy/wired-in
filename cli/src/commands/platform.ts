import type { Command } from 'commander';
import { getConfig, saveConfig } from '../lib/config-store.js';

const SUPPORTED_PLATFORMS = ['reddit', 'youtube', 'x', 'rss', 'news'] as const;
type Platform = (typeof SUPPORTED_PLATFORMS)[number];

function isPlatform(value: string): value is Platform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(value);
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export function platformCommand(program: Command): void {
  const plat = program
    .command('platform')
    .description('Manage platform integrations and API keys');

  plat
    .command('list')
    .description('List available platforms and their API key status')
    .action(() => {
      const config = getConfig();

      console.log('');
      console.log('  Platform Integrations');
      console.log('  --------------------');
      console.log('');
      console.log('  Platform    Status         Key');
      console.log('  --------    ----------     ---');

      for (const platform of SUPPORTED_PLATFORMS) {
        const key = config.apiKeys[platform];
        const status = key ? 'configured' : 'not set';
        const keyDisplay = key ? maskKey(key) : '-';
        const paddedPlatform = platform.padEnd(12);
        const paddedStatus = status.padEnd(15);
        console.log(`  ${paddedPlatform}${paddedStatus}${keyDisplay}`);
      }
      console.log('');
    });

  plat
    .command('set-key')
    .description('Store an API key for a platform')
    .argument('<platform>', `Platform name (${SUPPORTED_PLATFORMS.join(', ')})`)
    .argument('<key>', 'API key')
    .action((platform: string, key: string) => {
      if (!isPlatform(platform)) {
        console.error(`  Error: Unknown platform "${platform}".`);
        console.error(`  Supported: ${SUPPORTED_PLATFORMS.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      const config = getConfig();
      config.apiKeys[platform] = key;
      saveConfig(config);
      console.log(`  API key for "${platform}" saved.`);
    });

  plat
    .command('remove-key')
    .description('Remove a stored API key for a platform')
    .argument('<platform>', `Platform name (${SUPPORTED_PLATFORMS.join(', ')})`)
    .action((platform: string) => {
      if (!isPlatform(platform)) {
        console.error(`  Error: Unknown platform "${platform}".`);
        console.error(`  Supported: ${SUPPORTED_PLATFORMS.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      const config = getConfig();

      if (!config.apiKeys[platform]) {
        console.error(`  Error: No API key configured for "${platform}".`);
        process.exitCode = 1;
        return;
      }

      delete config.apiKeys[platform];
      saveConfig(config);
      console.log(`  API key for "${platform}" removed.`);
    });

  plat
    .command('test')
    .description('Test connectivity to a platform')
    .argument('<platform>', `Platform name (${SUPPORTED_PLATFORMS.join(', ')})`)
    .action((platform: string) => {
      if (!isPlatform(platform)) {
        console.error(`  Error: Unknown platform "${platform}".`);
        console.error(`  Supported: ${SUPPORTED_PLATFORMS.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      const config = getConfig();
      const key = config.apiKeys[platform];

      if (!key) {
        console.error(`  Error: No API key configured for "${platform}".`);
        console.error(`  Set one with: wiredin platform set-key ${platform} <key>`);
        process.exitCode = 1;
        return;
      }

      console.log(`  Testing connectivity to ${platform}...`);
      console.log('');

      // Simulate a connectivity test since we do not have live endpoints yet
      console.log(`  Platform  : ${platform}`);
      console.log(`  API Key   : ${maskKey(key)}`);
      console.log(`  Gateway   : ${config.gatewayUrl}`);
      console.log(`  Status    : ready (gateway not yet running)`);
      console.log('');
      console.log('  Note: Full connectivity tests require a running gateway.');
      console.log('  Start with: wiredin start');
      console.log('');
    });
}
