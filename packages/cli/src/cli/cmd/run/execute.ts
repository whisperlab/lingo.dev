import chalk from "chalk";
import { Listr } from "listr2";
import pLimit from "p-limit";
import _ from "lodash";
import path from "path";

import { colors } from "../../constants";
import { CmdRunContext, CmdRunTask } from "./_types";
import { commonTaskRendererOptions } from "./_const";
import createBucketLoader from "../../loaders";
import { createDeltaProcessor } from "../../utils/delta";

export default async function execute(input: CmdRunContext) {
  console.log(chalk.hex(colors.orange)("[Localization]"));

  return new Listr<CmdRunContext>(
    [
      {
        title: "Initializing translation engine",
        task: async (ctx, task) => {
          task.title = `Translation engine ${chalk.hex(colors.green)("ready")} (${ctx.localizer!.id})`;
        },
      },
      {
        title: "Processing translation tasks",
        task: (ctx, task) => {
          ctx.results = new Map();

          const limit = pLimit(input.flags.concurrency);
          const mutex = pLimit(1);

          const workerCount =
            Number.isFinite(ctx.flags.concurrency) && ctx.flags.concurrency > 0
              ? ctx.flags.concurrency
              : Math.min(10, ctx.tasks.length);
          const workerTasks = Array.from(
            { length: workerCount },
            (_tmp, workerIdx) => ({
              title: "Initializing...",
              task: async (_subCtx: any, subTask: any) => {
                const assignedTasks = ctx.tasks.filter(
                  (_, idx) => idx % workerCount === workerIdx,
                );

                for (const assignedTask of assignedTasks) {
                  const displayPath = path.relative(
                    globalThis.process.cwd(),
                    assignedTask.bucketPathPattern.replace(
                      "[locale]",
                      assignedTask.targetLocale,
                    ),
                  );
                  subTask.title = `Processing: ${chalk.dim(displayPath)} (${chalk.yellow(
                    assignedTask.sourceLocale,
                  )} -> ${chalk.yellow(assignedTask.targetLocale)})`;

                  const bucketLoader = createBucketLoader(
                    assignedTask.bucketType,
                    assignedTask.bucketPathPattern,
                    {
                      defaultLocale: assignedTask.sourceLocale,
                      isCacheRestore: false,
                      injectLocale: assignedTask.injectLocale,
                    },
                    assignedTask.lockedKeys,
                    assignedTask.lockedPatterns,
                  );
                  bucketLoader.setDefaultLocale(assignedTask.sourceLocale);
                  await bucketLoader.init();

                  const deltaProcessor = createDeltaProcessor(
                    assignedTask.bucketPathPattern,
                  );
                  const sourceData = await bucketLoader.pull(
                    assignedTask.sourceLocale,
                  );
                  const targetData = await bucketLoader.pull(
                    assignedTask.targetLocale,
                  );
                  const checksums = await deltaProcessor.loadChecksums();
                  const delta = await deltaProcessor.calculateDelta({
                    sourceData,
                    targetData,
                    checksums,
                  });

                  const processableData = _.chain(sourceData)
                    .entries()
                    .filter(
                      ([key, value]) =>
                        delta.added.includes(key) ||
                        delta.updated.includes(key) ||
                        !!ctx.flags.force,
                    )
                    .fromPairs()
                    .value();

                  const taskResult = await limit(async () => {
                    try {
                      const processedTargetData = await ctx.localizer!.localize(
                        {
                          sourceLocale: assignedTask.sourceLocale,
                          targetLocale: assignedTask.targetLocale,
                          sourceData,
                          targetData,
                          processableData,
                        },
                      );

                      const finalTargetData = _.merge(
                        {},
                        sourceData,
                        targetData,
                        processedTargetData,
                      );

                      await bucketLoader.push(
                        assignedTask.targetLocale,
                        finalTargetData,
                      );

                      return { success: true };
                    } catch (error) {
                      return {
                        success: false,
                        error: error as Error,
                      };
                    }
                  });

                  await mutex(async () => {
                    const checksums =
                      await deltaProcessor.createChecksums(sourceData);
                    await deltaProcessor.saveChecksums(checksums);
                  });

                  ctx.results.set(assignedTask, taskResult);

                  const successfulTasksCount = Array.from(
                    ctx.results.values(),
                  ).filter((result) => result.success).length;
                  const failedTasksCount = Array.from(
                    ctx.results.values(),
                  ).filter((result) => !result.success).length;

                  task.title = `Processed ${chalk.green(successfulTasksCount)}/${ctx.tasks.length}, Failed ${chalk.red(failedTasksCount)}`;
                }

                subTask.title = "Done";
              },
            }),
          );

          return task.newListr(workerTasks, {
            concurrent: true,
            exitOnError: false,
            rendererOptions: {
              ...commonTaskRendererOptions,
              collapseSubtasks: true,
            },
          });
        },
      },
    ],
    {
      exitOnError: false,
      rendererOptions: commonTaskRendererOptions,
    },
  ).run(input);
}
