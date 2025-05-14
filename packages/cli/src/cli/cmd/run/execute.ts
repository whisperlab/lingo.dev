import chalk from "chalk";
import { Listr } from "listr2";
import pLimit from "p-limit";
import _ from "lodash";
import path from "path";

import { colors } from "../../constants";
import { CmdRunContext } from "./_types";
import { commonTaskRendererOptions } from "./_const";

export default async function execute(input: CmdRunContext) {
  console.log(chalk.hex(colors.orange)("[Localization]"));

  return new Listr<CmdRunContext>(
    [
      {
        title: "Initializing translation engine",
        task: async (ctx, task) => {
          task.title = `Translation engine ${chalk.hex(colors.green)("ready")} (${ctx.localizer.name})`;
        },
      },
      {
        title: "Processing translation tasks",
        task: (ctx, task) => {
          ctx.results = new Map();

          const limit = pLimit(input.flags.concurrency);

          const completed = { success: 0, failed: 0 };

          const workerCount =
            Number.isFinite(ctx.flags.concurrency) && ctx.flags.concurrency > 0
              ? ctx.flags.concurrency
              : Math.min(10, ctx.tasks.length);
          const workerTasks = Array.from(
            { length: workerCount },
            (_, workerIdx) => ({
              title: "Initializing...",
              task: async (_subCtx: any, subTask: any) => {
                const assignedTasks = ctx.tasks.filter(
                  (_, idx) => idx % workerCount === workerIdx,
                );

                for (const assignedTask of assignedTasks) {
                  const displayPath = path.relative(
                    globalThis.process.cwd(),
                    assignedTask.filePathPlaceholder.replace(
                      "[locale]",
                      assignedTask.targetLocale,
                    ),
                  );
                  subTask.title = `Processing: ${chalk.dim(displayPath)} (${chalk.yellow(
                    assignedTask.sourceLocale,
                  )} -> ${chalk.yellow(assignedTask.targetLocale)})`;

                  const taskResult = await limit(() =>
                    runSingleTask(assignedTask),
                  );

                  ctx.results.set(assignedTask, taskResult);

                  if (taskResult.success) {
                    completed.success++;
                  } else {
                    completed.failed++;
                  }

                  task.title = `Processed ${chalk.green(completed.success)}/${ctx.tasks.length}, Failed ${chalk.red(
                    completed.failed,
                  )}`;
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

async function runSingleTask(localizationTask: any) {
  const { bucketType, filePathPlaceholder, sourceLocale, targetLocale } =
    localizationTask;

  //wait 500ms
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log(JSON.stringify(localizationTask));

  return { success: true } as {
    success: boolean;
    error?: Error;
  };
}
