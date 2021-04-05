import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';

import fs from 'fs';
import path from 'path';
import semver from 'semver';

import { JavaBase } from '../base-installer';
import { JavaInstallerOptions, JavaDownloadRelease, JavaInstallerResults } from '../base-models';
import { extractJdkFile } from '../../util';
import { MACOS_JAVA_CONTENT_POSTFIX } from '../../constants';

export class LocalDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions, private jdkFile?: string) {
    super('jdkfile', installerOptions);
  }

  public async setupJava(): Promise<JavaInstallerResults> {
    let foundJava = this.findInToolcache();

    if (foundJava) {
      core.info(`Resolved Java ${foundJava.version} from tool-cache`);
    } else {
      core.info(`Java ${this.version} was not found in tool-cache. Trying to unpack JDK file...`);
      if (!this.jdkFile) {
        throw new Error("'jdkFile' is not specified");
      }
      const jdkFilePath = path.resolve(this.jdkFile);
      const stats = fs.statSync(jdkFilePath);

      if (!stats.isFile()) {
        throw new Error(`JDK file was not found in path '${jdkFilePath}'`);
      }

      core.info(`Extracting Java from '${jdkFilePath}'`);

      const extractedJavaPath = await extractJdkFile(jdkFilePath);
      const archiveName = fs.readdirSync(extractedJavaPath)[0];
      const archivePath = path.join(extractedJavaPath, archiveName);
      const javaVersion = this.version;

      let javaPath = await tc.cacheDir(
        archivePath,
        this.toolcacheFolderName,
        this.getToolcacheVersionName(javaVersion),
        this.architecture
      );

      // for different Java distributions, postfix can exist or not so need to check both cases
      if (
        process.platform === 'darwin' &&
        fs.existsSync(path.join(javaPath, MACOS_JAVA_CONTENT_POSTFIX))
      ) {
        javaPath = path.join(javaPath, MACOS_JAVA_CONTENT_POSTFIX);
      }

      foundJava = {
        version: javaVersion,
        path: javaPath
      };
    }

    core.info(`Setting Java ${foundJava.version} as default`);

    this.setJavaDefault(foundJava.version, foundJava.path);
    return foundJava;
  }

  protected async findPackageForDownload(version: string): Promise<JavaDownloadRelease> {
    throw new Error('This method should not be implemented in local file provider');
  }

  protected async downloadTool(javaRelease: JavaDownloadRelease): Promise<JavaInstallerResults> {
    throw new Error('This method should not be implemented in local file provider');
  }
}
