import chalk from "chalk";
import { Listr, ListrTask, ListrTaskWrapper } from "listr2";
import pLimit, { LimitFunction } from "p-limit";
import _ from "lodash";
import path from "path";

import { colors } from "../../constants";
import { CmdRunContext, CmdRunTask, CmdRunTaskResult } from "./_types";
import { commonTaskRendererOptions } from "./_const";
import createBucketLoader from "../../loaders";
import { createDeltaProcessor } from "../../utils/delta";

const MAX_WORKER_COUNT = 10;

function createWorkerStatusMessage(args: {
  assignedTask: CmdRunTask;
  percentage: number;
}) {
  const displayPath = args.assignedTask.bucketPathPattern.replace(
    "[locale]",
    args.assignedTask.targetLocale,
  );
  return `[${chalk.hex(colors.yellow)(`${args.percentage}%`)}] Processing: ${chalk.dim(
    displayPath,
  )} (${chalk.hex(colors.yellow)(args.assignedTask.sourceLocale)} -> ${chalk.hex(
    colors.yellow,
  )(args.assignedTask.targetLocale)})`;
}

function createLoaderForTask(assignedTask: CmdRunTask) {
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

  return bucketLoader;
}

function createWorkerTask(args: {
  ctx: CmdRunContext;
  assignedTasks: CmdRunTask[];
  lockfileLimiter: LimitFunction;
  i18nLimiter: LimitFunction;
  onDone: () => void;
}): ListrTask {
  return {
    title: "Initializing...",
    task: async (_subCtx: any, subTask: any) => {
      for (const assignedTask of args.assignedTasks) {
        subTask.title = createWorkerStatusMessage({
          assignedTask,
          percentage: 0,
        });
        const bucketLoader = createLoaderForTask(assignedTask);

        const deltaProcessor = createDeltaProcessor(
          assignedTask.bucketPathPattern,
        );
        const sourceData = await bucketLoader.pull(assignedTask.sourceLocale);
        const targetData = await bucketLoader.pull(assignedTask.targetLocale);
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
              !!args.ctx.flags.force,
          )
          .fromPairs()
          .value();

        const taskResult = await args.i18nLimiter(async () => {
          try {
            const processedTargetData = await args.ctx.localizer!.localize(
              {
                sourceLocale: assignedTask.sourceLocale,
                targetLocale: assignedTask.targetLocale,
                sourceData,
                targetData,
                processableData,
              },
              (progress) => {
                subTask.title = createWorkerStatusMessage({
                  assignedTask,
                  percentage: progress,
                });
              },
            );

            const finalTargetData = _.merge(
              {},
              sourceData,
              targetData,
              processedTargetData,
            );

            await bucketLoader.push(assignedTask.targetLocale, finalTargetData);

            return { success: true };
          } catch (error) {
            return {
              success: false,
              error: error as Error,
            };
          }
        });

        await args.lockfileLimiter(async () => {
          const checksums = await deltaProcessor.createChecksums(sourceData);
          await deltaProcessor.saveChecksums(checksums);
        });

        args.ctx.results.set(assignedTask, taskResult);
      }

      subTask.title = "Done";
    },
  };
}

function createWorkerTasks(ctx: CmdRunContext, onDone: () => void) {
  const i18nLimiter = pLimit(ctx.flags.concurrency);
  const lockfileLimiter = pLimit(1);
  const workersCount = Math.min(ctx.tasks.length, MAX_WORKER_COUNT);

  const result: ListrTask[] = [];
  for (let i = 0; i < workersCount; i++) {
    const assignedTasks = ctx.tasks.filter(
      (_, idx) => idx % workersCount === i,
    );
    result.push(
      createWorkerTask({
        ctx,
        assignedTasks,
        lockfileLimiter,
        i18nLimiter,
        onDone,
      }),
    );
  }

  return result;
}

function countTasks(
  ctx: CmdRunContext,
  predicate: (task: CmdRunTask, result: CmdRunTaskResult) => boolean,
) {
  return Array.from(ctx.results.entries()).filter(([task, result]) =>
    predicate(task, result),
  ).length;
}

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
          const workerTasks = createWorkerTasks(ctx, () => {
            const succeededTasksCount = countTasks(
              ctx,
              (_t, result) => result.success,
            );
            const failedTasksCount = countTasks(
              ctx,
              (_t, result) => !result.success,
            );
            task.title = `Processed ${chalk.green(succeededTasksCount)}/${ctx.tasks.length}, Failed ${chalk.red(failedTasksCount)}`;
          });

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
