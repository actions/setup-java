import * as path from 'path';

export function getTempDir() {
  let tempDirectory = process.env.RUNNER_TEMP;
  if (tempDirectory === undefined) {
    let baseLocation;
    if (isWindows()) {
      // On windows use the USERPROFILE env variable
      baseLocation = process.env['USERPROFILE']
        ? process.env['USERPROFILE']
        : 'C:\\';
    } else {
      if (process.platform === 'darwin') {
        baseLocation = '/Users';
      } else {
        baseLocation = '/home';
      }
    }
    tempDirectory = path.join(baseLocation, 'actions', 'temp');
  }
  return tempDirectory;
}

export function isWindows() {
  return process.platform === 'win32';
}
