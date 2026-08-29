import * as core from '@actions/core';

import fs from 'fs';
import path from 'path';

import {JavaBase} from '../base-installer.js';
import {
  JavaInstallerOptions,
  JavaDownloadRelease,
  JavaInstallerResults
} from '../base-models.js';
import {cacheJdkDir, extractJdkFile} from '../../util.js';
import {MACOS_JAVA_CONTENT_POSTFIX} from '../../constants.js';
import {createReadStream} from 'fs';
import {createHash} from 'crypto';
import type {JdkCache} from '../../jdk-cache.js';

export class LocalDistribution extends JavaBase {
  constructor(
    installerOptions: JavaInstallerOptions,
    private jdkFile?: string
  ) {
    super('jdkfile', installerOptions);
  }

  public async setupJava(): Promise<JavaInstallerResults> {
    if (this.latest) {
      throw new Error(
        "The 'latest' version alias is not supported for the 'jdkfile' distribution. Please specify a concrete version."
      );
    }
    if (this.verifySignature) {
      throw new Error(
        `Input 'verify-signature' is not supported for distribution '${this.distribution}'.`
      );
    }

    let foundJava = this.forceDownload ? null : this.findInToolcache();

    if (foundJava) {
      core.info(`Resolved Java ${foundJava.version} from tool-cache`);
    } else {
      core.info(
        `Java ${this.version} was not found in tool-cache. Trying to unpack JDK file...`
      );
      if (!this.jdkFile) {
        throw new Error("'jdkFile' is not specified");
      }
      const jdkFilePath = path.resolve(this.jdkFile);
      const stats = fs.statSync(jdkFilePath);

      if (!stats.isFile()) {
        throw new Error(`JDK file was not found in path '${jdkFilePath}'`);
      }

      let jdkCache: JdkCache | undefined;
      if (this.cacheJdk) {
        const [{getJdkVerificationIdentity}, source] = await Promise.all([
          import('../../jdk-cache.js'),
          hashFile(jdkFilePath)
        ]);
        jdkCache = {
          distribution: this.distribution,
          packageType: this.packageType,
          architecture: this.architecture,
          version: this.version,
          source,
          verification: getJdkVerificationIdentity(false, false),
          path: this.getJdkCachePath(this.version)
        };
      }
      if (!this.forceDownload && jdkCache) {
        const {restoreJdk} = await import('../../jdk-cache.js');
        const restored = await restoreJdk(jdkCache);
        const restoredPath = restored
          ? this.getRestoredJdkPath(this.version)
          : undefined;
        if (restoredPath) {
          foundJava = {
            version: this.version,
            path: restoredPath
          };
        }
      }

      if (!foundJava) {
        core.info(`Extracting Java from '${jdkFilePath}'`);

        const extractedJavaPath = await extractJdkFile(jdkFilePath);
        const archiveName = fs.readdirSync(extractedJavaPath)[0];
        const archivePath = path.join(extractedJavaPath, archiveName);
        const javaVersion = this.version;

        const javaPath = await cacheJdkDir(
          archivePath,
          this.toolcacheFolderName,
          this.getToolcacheVersionName(javaVersion),
          this.architecture
        );

        foundJava = {
          version: javaVersion,
          path: javaPath
        };
        if (jdkCache) {
          const {registerJdk} = await import('../../jdk-cache.js');
          registerJdk(jdkCache);
        }
      }
    }

    // JDK folder may contain postfix "Contents/Home" on macOS
    const macOSPostfixPath = path.join(
      foundJava.path,
      MACOS_JAVA_CONTENT_POSTFIX
    );
    if (process.platform === 'darwin' && fs.existsSync(macOSPostfixPath)) {
      foundJava.path = macOSPostfixPath;
    }

    if (this.setDefault) {
      core.info(`Setting Java ${foundJava.version} as the default`);
      this.setJavaDefault(foundJava.version, foundJava.path);
    } else {
      core.info(
        `Installing Java ${foundJava.version} (not setting as default)`
      );
      this.setJavaEnvironment(foundJava.version, foundJava.path);
    }
    return foundJava;
  }

  protected async findPackageForDownload(
    version: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<JavaDownloadRelease> {
    throw new Error(
      'This method should not be implemented in local file provider'
    );
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<JavaInstallerResults> {
    throw new Error(
      'This method should not be implemented in local file provider'
    );
  }
}

async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}
