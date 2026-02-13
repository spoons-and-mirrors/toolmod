import z from 'zod';

export interface ReadToolScrubStats {
  modified: boolean;
  descriptionLinesRemoved: number;
  removedDescriptionLines: string[];
  removedSchemaProperties: string[];
}

const READ_DESCRIPTION_MARKERS = [
  'Read a file or directory from the local filesystem.',
  'Usage:',
  '- The filePath parameter should be an absolute path.',
];

const READ_DESCRIPTION_REMOVALS = [
  'By default, this tool returns up to 2000 lines',
  'offset parameter',
  'larger offset',
  "Use 'offset'",
];

function isReadDescription(text: string): boolean {
  return READ_DESCRIPTION_MARKERS.every((marker) => text.includes(marker));
}

function shouldRemoveReadDescriptionLine(line: string): boolean {
  return READ_DESCRIPTION_REMOVALS.some((fragment) => line.includes(fragment));
}

function scrubReadDescription(text: string, stats: ReadToolScrubStats): string {
  if (!isReadDescription(text)) {
    return text;
  }

  const lines = text.split('\n');
  const removed = lines.filter((line) => shouldRemoveReadDescriptionLine(line));
  const filtered = lines.filter((line) => !shouldRemoveReadDescriptionLine(line));

  if (filtered.length === lines.length) {
    return text;
  }

  stats.descriptionLinesRemoved += removed.length;
  stats.removedDescriptionLines.push(...removed);
  stats.modified = true;
  return filtered.join('\n');
}

function isZodObject(value: unknown): value is z.ZodObject<any> {
  return value instanceof z.ZodObject;
}

function scrubReadParameters(schema: unknown, stats: ReadToolScrubStats): unknown {
  if (!isZodObject(schema)) {
    return schema;
  }

  const shape = schema.shape;
  const nextEntries = Object.entries(shape).filter(([key]) => key !== 'offset' && key !== 'limit');
  if (nextEntries.length === Object.keys(shape).length) {
    return schema;
  }

  const removed = Object.keys(shape).filter((key) => key === 'offset' || key === 'limit');
  stats.removedSchemaProperties.push(...removed);
  stats.modified = true;
  return z.object(Object.fromEntries(nextEntries));
}

function zodTypeName(schema: z.ZodTypeAny): string {
  const def = (schema as { _def?: { typeName?: string } })._def;
  if (def?.typeName) {
    return def.typeName;
  }

  if (schema.constructor?.name) {
    return schema.constructor.name;
  }

  return 'unknown';
}

function describeZod(schema: z.ZodTypeAny): {
  type: string;
  description?: string;
  optional?: boolean;
} {
  if (schema instanceof z.ZodOptional) {
    const inner = schema._def.innerType as z.ZodTypeAny;
    const base = describeZod(inner);
    return {
      ...base,
      optional: true,
    };
  }

  const def = (schema as { _def?: { description?: string } })._def;
  const description = typeof def?.description === 'string' ? def.description : undefined;
  return {
    type: zodTypeName(schema),
    description,
  };
}

export function formatParameters(parameters: unknown): unknown {
  if (!isZodObject(parameters)) {
    return parameters;
  }

  const shape = parameters.shape;
  const properties = Object.fromEntries(
    Object.entries(shape).map(([key, value]) => {
      return [key, describeZod(value as z.ZodTypeAny)];
    })
  );

  return {
    type: 'object',
    properties,
  };
}

export function scrubReadToolDefinition(output: {
  description: string;
  parameters: unknown;
}): ReadToolScrubStats {
  const stats: ReadToolScrubStats = {
    modified: false,
    descriptionLinesRemoved: 0,
    removedDescriptionLines: [],
    removedSchemaProperties: [],
  };

  output.description = scrubReadDescription(output.description, stats);
  output.parameters = scrubReadParameters(output.parameters, stats);

  return stats;
}
