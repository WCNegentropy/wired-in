import { program } from 'commander';
import { configCommand } from './commands/config.js';
import { workspaceCommand } from './commands/workspace.js';
import { platformCommand } from './commands/platform.js';
import { statusCommand } from './commands/status.js';
import { startCommand } from './commands/start.js';

program
  .name('wiredin')
  .description('Wired-In CLI — Manage your content aggregation dashboard')
  .version('0.1.0');

configCommand(program);
workspaceCommand(program);
platformCommand(program);
statusCommand(program);
startCommand(program);

program.parse();
