/**
 * Models for the project build archive — every developer publishes a build
 * (an APK / artifact) per version; the source is pushed to the company GitHub
 * automatically, so code is never lost and any version can be restored.
 *
 * Backend contract: see `scratchpad/backend-prompt-dev-portal-and-vault.md`.
 * Today these are served by `MockProjectBuildsGateway`; swapping to the HTTP
 * adapter changes only `project-builds-gateway.provider.ts`.
 */

/** Target a build was produced for. */
export type BuildPlatform = 'Android' | 'iOS' | 'Web' | 'Backend' | 'Other';

/** Lifecycle of the automatic GitHub push that follows an upload. */
export type BuildStatus = 'Pending' | 'Uploading' | 'Pushed' | 'Failed';

export const BUILD_PLATFORMS: ReadonlyArray<BuildPlatform> = [
  'Android',
  'iOS',
  'Web',
  'Backend',
  'Other',
];

/** One published build/version of a project. */
export interface ProjectBuild {
  id: string;
  projectId: number;
  /** Auto-incremented per project. */
  buildNumber: number;
  versionName: string;
  platform: BuildPlatform;
  developerId: string;
  developerName: string;
  /** Server-relative artifact URL (the APK / package). */
  artifactUrl: string | null;
  artifactName: string | null;
  artifactSizeBytes: number | null;
  /** Changelog / release notes. */
  notes: string | null;
  // Git push bookkeeping — filled by the backend after the auto-push.
  gitRepoUrl: string | null;
  gitBranch: string | null;
  gitCommitSha: string | null;
  gitTag: string | null;
  status: BuildStatus;
  /** Set only when `status === 'Failed'`. */
  errorMessage: string | null;
  createdAt: string;
}

/** What the composer collects to publish a build. */
export interface NewBuildDraft {
  projectId: number;
  versionName: string;
  platform: BuildPlatform;
  notes: string;
  /** The chosen artifact file (APK/package). Mock only reads its name/size. */
  artifact: File | null;
}
