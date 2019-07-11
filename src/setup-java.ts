import * as core from '@actions/core';
import * as installer from './installer';

async function run() {
  try {
    const version = core.getInput('version', {required: true});
    const arch = core.getInput('architecture', {required: true});
    const jdkFile = core.getInput('jdkFile', {required: true});

    await installer.getJava(version, arch, jdkFile);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
