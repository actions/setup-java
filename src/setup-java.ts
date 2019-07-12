import * as core from '@actions/core';
import * as installer from './installer';
import * as path from 'path';

async function run() {
  try {
    const version = core.getInput('version', {required: true});
    const arch = core.getInput('architecture', {required: true});
    const jdkFile = core.getInput('jdkFile', {required: true});

    await installer.getJava(version, arch, jdkFile);

    const matchersPath = path.join(__dirname, '..', '.github');
    console.log(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
