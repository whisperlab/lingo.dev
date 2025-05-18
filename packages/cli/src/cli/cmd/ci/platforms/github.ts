import { Octokit } from "octokit";
import { PlatformKit } from "./_base";
import Z from "zod";

export class GitHubPlatformKit extends PlatformKit {
  private _octokit?: Octokit;

  private get octokit(): Octokit {
    if (!this._octokit) {
      this._octokit = new Octokit({ auth: this.platformConfig.ghToken });
    }
    return this._octokit;
  }

  async branchExists({ branch }: { branch: string }) {
    return await this.octokit.rest.repos
      .getBranch({
        branch,
        owner: this.platformConfig.repositoryOwner,
        repo: this.platformConfig.repositoryName,
      })
      .then((r) => r.data)
      .then((v) => !!v)
      .catch((r) => (r.status === 404 ? false : Promise.reject(r)));
  }

  async getOpenPullRequestNumber({ branch }: { branch: string }) {
    return await this.octokit.rest.pulls
      .list({
        head: `${this.platformConfig.repositoryOwner}:${branch}`,
        owner: this.platformConfig.repositoryOwner,
        repo: this.platformConfig.repositoryName,
        base: this.platformConfig.baseBranchName,
        state: "open",
      })
      .then(({ data }) => data[0])
      .then((pr) => pr?.number);
      .catch((r) => (r.status === 404 ? undefined : Promise.reject(r)));
  }

  async closePullRequest({ pullRequestNumber }: { pullRequestNumber: number }) {
    await this.octokit.rest.pulls.update({
      pull_number: pullRequestNumber,
      owner: this.platformConfig.repositoryOwner,
      repo: this.platformConfig.repositoryName,
      state: "closed",
    });
  }

  async createPullRequest({
    head,
    title,
    body,
  }: {
    head: string;
    title: string;
    body?: string;
  }) {
    return await this.octokit.rest.pulls
      .create({
        head,
        title,
        body,
        owner: this.platformConfig.repositoryOwner,
        repo: this.platformConfig.repositoryName,
        base: this.platformConfig.baseBranchName,
      })
      .then(({ data }) => data.number);
  }

  async commentOnPullRequest({
    pullRequestNumber,
    body,
  }: {
    pullRequestNumber: number;
    body: string;
  }) {
    await this.octokit.rest.issues.createComment({
      issue_number: pullRequestNumber,
      body,
      owner: this.platformConfig.repositoryOwner,
      repo: this.platformConfig.repositoryName,
    });
  }

  async gitConfig() {
    const { ghToken, repositoryOwner, repositoryName } = this.platformConfig;
    const { processOwnCommits } = this.config;

    if (ghToken && processOwnCommits) {
      console.log(
        "Using provided GH_TOKEN. This will trigger your CI/CD pipeline to run again.",
      );

      const url = `https://${ghToken}@github.com/${repositoryOwner}/${repositoryName}.git`;

      super.gitConfig(ghToken, url);
    }
  }

  get platformConfig() {
    const env = Z.object({
      GITHUB_REPOSITORY: Z.string(),
      GITHUB_REPOSITORY_OWNER: Z.string(),
      GITHUB_REF_NAME: Z.string(),
      GITHUB_HEAD_REF: Z.string(),
      GH_TOKEN: Z.string().optional(),
    }).parse(process.env);

    const baseBranchName = !env.GITHUB_REF_NAME.endsWith("/merge")
      ? env.GITHUB_REF_NAME
      : env.GITHUB_HEAD_REF;

    return {
      ghToken: env.GH_TOKEN,
      baseBranchName,
      repositoryOwner: env.GITHUB_REPOSITORY_OWNER,
      repositoryName: env.GITHUB_REPOSITORY.split("/")[1],
    };
  }

  buildPullRequestUrl(pullRequestNumber: number) {
    const { repositoryOwner, repositoryName } = this.platformConfig;
    return `https://github.com/${repositoryOwner}/${repositoryName}/pull/${pullRequestNumber}`;
  }
}
