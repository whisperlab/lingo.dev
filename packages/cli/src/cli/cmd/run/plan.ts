import chalk from "chalk";
import { Listr, ListrDefaultRendererLogLevels } from "listr2";
import path from "path";

import { colors } from "../../constants";
import { I18nConfig, resolveOverriddenLocale } from "@lingo.dev/_spec";
import { getBuckets } from "../../utils/buckets";
import { commonTaskRendererOptions } from "./_const";
import { CmdRunContext, CmdRunTask } from "./_types";

export default async function plan(
  input: CmdRunContext,
): Promise<CmdRunContext> {
  console.log(chalk.hex(colors.orange)("[Planning]"));

  return new Listr<CmdRunContext>(
    [
      {
        title: "Analyzing project",
        task: async (ctx, task) => {
          task.title = `Found ${chalk.hex(colors.yellow)(Object.keys(ctx.config.buckets).length.toString())} bucket(s)`;
        },
      },
      {
        title: "Scanning documents",
        task: async (ctx, task) => {
          const buckets = getBuckets(ctx.config);

          // Calculate total number of placeholdered paths for display purposes
          const totalPathPatterns = buckets.reduce(
            (acc, b) => acc + b.paths.length,
            0,
          );

          task.title = `Found ${chalk.hex(colors.yellow)(totalPathPatterns.toString())} path pattern(s)`;
        },
      },
      {
        title: "Detecting locales",
        task: async (ctx, task) => {
          const targets = ctx.config.locale.targets;
          task.title = `Found ${chalk.hex(colors.yellow)(targets.length.toString())} target locales: ${targets.map((l) => chalk.hex(colors.yellow)(l)).join(", ")}`;
        },
      },
      {
        title: "Computing translation tasks",
        task: async (ctx, task) => {
          const buckets = getBuckets(ctx.config);
          ctx.tasks = [];

          for (const bucket of buckets) {
            for (const bucketPath of bucket.paths) {
              const sourceLocale = resolveOverriddenLocale(
                ctx.config.locale.source,
                bucketPath.delimiter,
              );

              for (const _targetLocale of ctx.config.locale.targets) {
                const targetLocale = resolveOverriddenLocale(
                  _targetLocale,
                  bucketPath.delimiter,
                );

                // Skip if source and target are identical (shouldn't happen but guard)
                if (sourceLocale === targetLocale) continue;

                ctx.tasks.push({
                  sourceLocale,
                  targetLocale,
                  bucketType: bucket.type,
                  filePathPlaceholder: path.normalize(bucketPath.pathPattern),
                });
              }
            }
          }

          task.title = `Prepared ${chalk.hex(colors.green)(ctx.tasks.length.toString())} translation task(s)`;
        },
      },
    ],
    {
      rendererOptions: commonTaskRendererOptions,
    },
  ).run(input);
}
