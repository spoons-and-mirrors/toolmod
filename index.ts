import type { Plugin } from '@opencode-ai/plugin';
import { formatParameters, scrubReadToolDefinition } from './scrub';

const plugin: Plugin = async () => {
  return {
    'tool.definition': async (
      input: { toolID: string },
      output: { description: string; parameters: unknown }
    ) => {
      if (input.toolID !== 'read') {
        return;
      }

      const stats = scrubReadToolDefinition(output);
      const descriptionLines = output.description.split('\n');
      const parameters = formatParameters(output.parameters);

      if (!stats.modified) {
        return;
      }

      console.log('[tooldmod] Read tool definition (scrubbed)', {
        toolID: input.toolID,
        descriptionLines,
        parameters,
        descriptionLinesRemoved: stats.descriptionLinesRemoved,
        removedDescriptionLines: stats.removedDescriptionLines,
        removedSchemaProperties: stats.removedSchemaProperties,
      });
    },
  };
};

export default plugin;
