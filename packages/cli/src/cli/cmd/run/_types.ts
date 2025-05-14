import {
  bucketTypeSchema,
  I18nConfig,
  localeCodeSchema,
} from "@lingo.dev/_spec";
import { z } from "zod";

export type CmdRunContext = {
  flags: CmdRunFlags;
  config: I18nConfig;
  localizer: CmdRunLocalizer;
  tasks: CmdRunTask[];
  results: Map<CmdRunTask, { success: boolean; error?: Error }>;
};

export type CmdRunTask = {
  sourceLocale: string;
  targetLocale: string;
  bucketType: string;
  filePathPlaceholder: string;
};

export const flagsSchema = z.object({
  apiKey: z.string().optional(),
  locale: z.array(localeCodeSchema).optional(),
  bucket: z.array(bucketTypeSchema).optional(),
  force: z.boolean().optional(),
  frozen: z.boolean().optional(),
  verbose: z.boolean().optional(),
  strict: z.boolean().optional(),
  key: z.string().optional(),
  file: z.array(z.string()).optional(),
  interactive: z.boolean().default(false),
  concurrency: z.number().positive().default(4),
  debug: z.boolean().default(false),
});
export type CmdRunFlags = z.infer<typeof flagsSchema>;

export type CmdRunLocalizer = {
  name: string;
  fn: () => any;
};
