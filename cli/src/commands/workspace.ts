import type { Command } from 'commander';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { getConfig, saveConfig } from '../lib/config-store.js';
import type { WorkspaceConfig } from '../lib/config-store.js';

export function workspaceCommand(program: Command): void {
  const ws = program
    .command('workspace')
    .alias('ws')
    .description('Manage workspaces');

  ws
    .command('list')
    .description('List all workspaces')
    .action(() => {
      const config = getConfig();

      if (config.workspaces.length === 0) {
        console.log('');
        console.log('  No workspaces found. Create one with:');
        console.log('    wiredin workspace create <name>');
        console.log('');
        return;
      }

      console.log('');
      console.log('  Workspaces');
      console.log('  ----------');
      console.log('');

      for (const workspace of config.workspaces) {
        const active = workspace.name === config.activeWorkspace ? ' (active)' : '';
        const tiles = workspace.tiles.length;
        console.log(`  ${workspace.name}${active}`);
        console.log(`    Description : ${workspace.description || '(none)'}`);
        console.log(`    Tiles       : ${tiles}`);
        console.log(`    Created     : ${workspace.createdAt}`);
        console.log('');
      }
    });

  ws
    .command('create')
    .description('Create a new workspace')
    .argument('<name>', 'Workspace name')
    .option('-d, --description <desc>', 'Workspace description', '')
    .action((name: string, options: { description: string }) => {
      const config = getConfig();

      const exists = config.workspaces.some((w) => w.name === name);
      if (exists) {
        console.error(`  Error: Workspace "${name}" already exists.`);
        process.exitCode = 1;
        return;
      }

      const workspace: WorkspaceConfig = {
        id: randomUUID(),
        name,
        description: options.description,
        tiles: [],
        createdAt: new Date().toISOString(),
      };

      config.workspaces.push(workspace);

      // Auto-activate if this is the first workspace
      if (config.workspaces.length === 1) {
        config.activeWorkspace = name;
      }

      saveConfig(config);
      console.log(`  Created workspace "${name}".`);

      if (config.activeWorkspace === name) {
        console.log(`  Automatically set as active workspace.`);
      }
    });

  ws
    .command('switch')
    .description('Switch the active workspace')
    .argument('<name>', 'Workspace name')
    .action((name: string) => {
      const config = getConfig();

      const exists = config.workspaces.some((w) => w.name === name);
      if (!exists) {
        console.error(`  Error: Workspace "${name}" not found.`);
        process.exitCode = 1;
        return;
      }

      config.activeWorkspace = name;
      saveConfig(config);
      console.log(`  Switched to workspace "${name}".`);
    });

  ws
    .command('delete')
    .description('Delete a workspace')
    .argument('<name>', 'Workspace name')
    .action((name: string) => {
      const config = getConfig();

      const index = config.workspaces.findIndex((w) => w.name === name);
      if (index === -1) {
        console.error(`  Error: Workspace "${name}" not found.`);
        process.exitCode = 1;
        return;
      }

      config.workspaces.splice(index, 1);

      if (config.activeWorkspace === name) {
        config.activeWorkspace = config.workspaces.length > 0
          ? config.workspaces[0].name
          : null;
      }

      saveConfig(config);
      console.log(`  Deleted workspace "${name}".`);

      if (config.activeWorkspace) {
        console.log(`  Active workspace is now "${config.activeWorkspace}".`);
      }
    });

  ws
    .command('export')
    .description('Export workspace configuration as JSON')
    .argument('<name>', 'Workspace name')
    .action((name: string) => {
      const config = getConfig();

      const workspace = config.workspaces.find((w) => w.name === name);
      if (!workspace) {
        console.error(`  Error: Workspace "${name}" not found.`);
        process.exitCode = 1;
        return;
      }

      console.log(JSON.stringify(workspace, null, 2));
    });

  ws
    .command('import')
    .description('Import workspace from a JSON file')
    .argument('<file>', 'Path to JSON file')
    .action((file: string) => {
      const config = getConfig();

      let raw: string;
      try {
        raw = readFileSync(file, 'utf-8');
      } catch {
        console.error(`  Error: Could not read file "${file}".`);
        process.exitCode = 1;
        return;
      }

      let workspace: WorkspaceConfig;
      try {
        workspace = JSON.parse(raw) as WorkspaceConfig;
      } catch {
        console.error('  Error: Invalid JSON in file.');
        process.exitCode = 1;
        return;
      }

      if (!workspace.name || !workspace.id) {
        console.error('  Error: Invalid workspace format. Must have "name" and "id" fields.');
        process.exitCode = 1;
        return;
      }

      const exists = config.workspaces.some((w) => w.name === workspace.name);
      if (exists) {
        console.error(`  Error: Workspace "${workspace.name}" already exists.`);
        process.exitCode = 1;
        return;
      }

      config.workspaces.push(workspace);
      saveConfig(config);
      console.log(`  Imported workspace "${workspace.name}".`);
    });
}
