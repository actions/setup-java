import * as core from '@actions/core';
import * as installer from './installer';
import * as auth from './auth';
import * as path from 'path';

async function run() {
  try {
    let version = core.getInput('version');
    if (!version) {
      version = core.getInput('java-version', {required: true});
    }
    const arch = core.getInput('architecture', {required: true});
    const javaPackage = core.getInput('java-package', {required: true});
    const jdkFile = core.getInput('jdkFile', {required: false}) || '';

    await installer.getJava(version, arch, jdkFile, javaPackage);

    const matchersPath = path.join(__dirname, '..', '.github');
    console.log(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);

    const id = core.getInput('server-id', {required: false}) || undefined;
    const username =
      core.getInput('server-username', {required: false}) || undefined;
    const password =
      core.getInput('server-password', {required: false}) || undefined;

    await auth.configAuthentication(id, username, password);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
