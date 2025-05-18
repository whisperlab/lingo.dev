import { execSync } from "child_process";
import { InBranchFlow } from "./in-branch";

export class PullRequestFlow extends InBranchFlow {
  async preRun() {
    const canContinue = await super.preRun?.();
    if (!canContinue) {
      return false;
    }

    this.ora.start("Calculating automated branch name");
    this.i18nBranchName = this.calculatePrBranchName();
    this.ora.succeed(
      `Automated branch name calculated: ${this.i18nBranchName}`,
    );

    this.ora.start("Checking if branch exists");
    const branchExists = await this.checkBranchExistance(this.i18nBranchName);
    this.ora.succeed(branchExists ? "Branch exists" : "Branch does not exist");

    if (branchExists) {
      this.ora.start(`Checking out branch ${this.i18nBranchName}`);
      this.checkoutI18nBranch(this.i18nBranchName);
      this.ora.succeed(`Checked out branch ${this.i18nBranchName}`);

      this.ora.start(
        `Syncing with ${this.platformKit.platformConfig.baseBranchName}`,
      );
      this.syncI18nBranch();
      this.ora.succeed(`Checked out and synced branch ${this.i18nBranchName}`);
    } else {
      this.ora.start(`Creating branch ${this.i18nBranchName}`);
      this.createI18nBranch(this.i18nBranchName);
      this.ora.succeed(`Created branch ${this.i18nBranchName}`);
    }

    return true;
  }

  override async run() {
    return super.run(true);
  }

  async postRun() {
    if (!this.i18nBranchName) {
      throw new Error(
        "i18nBranchName is not set. Did you forget to call preRun?",
      );
    }

    this.ora.start("Checking if PR already exists");
    const pullRequestNumber = await this.ensureFreshPr(this.i18nBranchName);
    // await this.createLabelIfNotExists(pullRequestNumber, 'lingo.dev/i18n', false);
    this.ora.succeed(
      `Pull request ready: ${this.platformKit.buildPullRequestUrl(pullRequestNumber)}`,
    );
  }

  private calculatePrBranchName(): string {
    return `lingo.dev/${this.platformKit.platformConfig.baseBranchName}`;
  }

  private async checkBranchExistance(prBranchName: string) {
    return this.platformKit.branchExists({
      branch: prBranchName,
    });
  }

  private async ensureFreshPr(i18nBranchName: string) {
    // Check if PR exists
    this.ora.start(
      `Checking for existing PR with head ${i18nBranchName} and base ${this.platformKit.platformConfig.baseBranchName}`,
    );
    let prNumber = await this.platformKit.getOpenPullRequestNumber({
      branch: i18nBranchName,
    });

    if (prNumber) {
      this.ora.succeed(`Existing PR found: #${prNumber}`);
    } else {
      // Create new PR
      this.ora.start(`Creating new PR`);
      prNumber = await this.platformKit.createPullRequest({
        head: i18nBranchName,
        title: this.platformKit.config.pullRequestTitle,
        body: this.getPrBodyContent(),
      });
      this.ora.succeed(`Created new PR: #${prNumber}`);
    }

    return prNumber;
  }

  private checkoutI18nBranch(i18nBranchName: string) {
    execSync(`git fetch origin ${i18nBranchName}`, { stdio: "inherit" });
    execSync(`git checkout -b ${i18nBranchName}`, {
      stdio: "inherit",
    });
  }

  private createI18nBranch(i18nBranchName: string) {
    try {
      execSync(
        `git fetch origin ${this.platformKit.platformConfig.baseBranchName}`,
        { stdio: "inherit" },
      );
      execSync(
        `git checkout -b ${i18nBranchName} origin/${this.platformKit.platformConfig.baseBranchName}`,
        {
          stdio: "inherit",
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.ora.fail(`Failed to create branch: ${errorMessage}`);
      this.ora.info(`
      Troubleshooting tips:
      1. Make sure you have permission to create branches
      2. Check if the branch already exists locally (try 'git branch -a')
      3. Verify connectivity to remote repository
    `);
      throw new Error(`Branch creation failed: ${errorMessage}`);
    }
  }

  private syncI18nBranch() {
    if (!this.i18nBranchName) {
      throw new Error("i18nBranchName is not set");
    }

    this.ora.start(
      `Fetching latest changes from ${this.platformKit.platformConfig.baseBranchName}`,
    );
    execSync(
      `git fetch origin ${this.platformKit.platformConfig.baseBranchName}`,
      { stdio: "inherit" },
    );
    this.ora.succeed(
      `Fetched latest changes from ${this.platformKit.platformConfig.baseBranchName}`,
    );

    try {
      this.ora.start("Attempting to rebase branch");
      execSync(
        `git rebase origin/${this.platformKit.platformConfig.baseBranchName}`,
        { stdio: "inherit" },
      );
      this.ora.succeed("Successfully rebased branch");
    } catch (error) {
      this.ora.warn("Rebase failed, falling back to alternative sync method");

      this.ora.start("Aborting failed rebase");
      execSync("git rebase --abort", { stdio: "inherit" });
      this.ora.succeed("Aborted failed rebase");

      this.ora.start(
        `Resetting to ${this.platformKit.platformConfig.baseBranchName}`,
      );
      execSync(
        `git reset --hard origin/${this.platformKit.platformConfig.baseBranchName}`,
        { stdio: "inherit" },
      );
      this.ora.succeed(
        `Reset to ${this.platformKit.platformConfig.baseBranchName}`,
      );

      this.ora.start("Restoring target files");
      const targetFiles = ["i18n.lock"];
      const targetFileNames = execSync(
        `yarn lingo.dev show files --target ${this.platformKit.platformConfig.baseBranchName}`,
        { encoding: "utf8" },
      )
        .split("\n")
        .filter(Boolean);
      targetFiles.push(...targetFileNames);
      execSync(`git fetch origin ${this.i18nBranchName}`, { stdio: "inherit" });
      for (const file of targetFiles) {
        try {
          // bring all files to the i18n branch's state
          execSync(`git checkout FETCH_HEAD -- ${file}`, { stdio: "inherit" });
        } catch (error) {
          // If file doesn't exist in FETCH_HEAD, that's okay - just skip it
          this.ora.warn(`Skipping non-existent file: ${file}`);
          continue;
        }
      }
      this.ora.succeed("Restored target files");
    }

    this.ora.start("Checking for changes to commit");
    const hasChanges = this.checkCommitableChanges();
    if (hasChanges) {
      execSync("git add .", { stdio: "inherit" });
      execSync(
        `git commit -m "chore: sync with ${this.platformKit.platformConfig.baseBranchName}" --no-verify`,
        {
          stdio: "inherit",
        },
      );
      this.ora.succeed("Committed additional changes");
    } else {
      this.ora.succeed("No changes to commit");
    }
  }

  private getPrBodyContent(): string {
    return `
Hey team,

**Lingo.dev** here with fresh translations!

### In this update

- Added missing translations
- Performed brand voice, context and glossary checks
- Enhanced translations using AI Localization Engine

### Next Steps

- [ ] Review the changes
- [ ] Merge when ready
    `.trim();
  }
}
