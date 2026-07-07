import * as core from '@actions/core';
import {getBooleanInput} from './util';
import {
  INPUT_SHOW_DOWNLOAD_PROGRESS,
  MAVEN_ARGS_ENV,
  MAVEN_NO_TRANSFER_PROGRESS_FLAG,
  MAVEN_NO_TRANSFER_PROGRESS_LONG_FLAG
} from './constants';

/**
 * Configures the MAVEN_ARGS environment variable so that Maven suppresses
 * artifact transfer/download progress output by default, producing cleaner
 * CI logs.
 *
 * Behavior:
 * - When `show-download-progress` is `false` (the default), `-ntp`
 *   (`--no-transfer-progress`) is appended to any existing MAVEN_ARGS value.
 * - When `show-download-progress` is `true`, MAVEN_ARGS is left untouched so
 *   the user's own configuration (and Maven's default progress output) is
 *   preserved.
 *
 * The change is idempotent: if MAVEN_ARGS already disables transfer progress
 * (via `-ntp` or `--no-transfer-progress`) nothing is added. Any pre-existing
 * MAVEN_ARGS value is preserved.
 *
 * MAVEN_ARGS is honored by Maven 3.9.0+ and the Maven Wrapper; older Maven
 * versions ignore it, so this is a no-op there. It has no effect on non-Maven
 * builds such as Gradle or sbt.
 */
export function configureMavenArgs(): void {
  const showDownloadProgress = getBooleanInput(
    INPUT_SHOW_DOWNLOAD_PROGRESS,
    false
  );

  if (showDownloadProgress) {
    core.debug(
      `${INPUT_SHOW_DOWNLOAD_PROGRESS} is true; leaving ${MAVEN_ARGS_ENV} unchanged`
    );
    return;
  }

  const existingArgs = (process.env[MAVEN_ARGS_ENV] ?? '').trim();

  const alreadyDisabled = existingArgs
    .split(/\s+/)
    .some(
      arg =>
        arg === MAVEN_NO_TRANSFER_PROGRESS_FLAG ||
        arg === MAVEN_NO_TRANSFER_PROGRESS_LONG_FLAG
    );

  if (alreadyDisabled) {
    core.debug(
      `${MAVEN_ARGS_ENV} already disables transfer progress; leaving it unchanged`
    );
    return;
  }

  const updatedArgs = existingArgs
    ? `${existingArgs} ${MAVEN_NO_TRANSFER_PROGRESS_FLAG}`
    : MAVEN_NO_TRANSFER_PROGRESS_FLAG;

  core.exportVariable(MAVEN_ARGS_ENV, updatedArgs);
  core.info(
    `Configured ${MAVEN_ARGS_ENV} to include ${MAVEN_NO_TRANSFER_PROGRESS_FLAG} to suppress Maven transfer progress logs. ` +
      `Set '${INPUT_SHOW_DOWNLOAD_PROGRESS}: true' to keep the download progress output.`
  );
}
