import * as core from '@actions/core';
import {INPUT_PROBLEM_MATCHER} from './constants.js';
import {getBooleanInput} from './util.js';

export function configureProblemMatcher(matcherPath: string): void {
  const problemMatcherEnabled = getBooleanInput(INPUT_PROBLEM_MATCHER, true);

  if (!problemMatcherEnabled) {
    core.debug('Java problem matcher is disabled');
    return;
  }

  core.info(`##[add-matcher]${matcherPath}`);
}
