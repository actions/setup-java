export const MACOS_JAVA_CONTENT_POSTFIX = 'Contents/Home';
export const INPUT_JAVA_VERSION = 'java-version';
export const INPUT_JAVA_VERSION_FILE = 'java-version-file';
export const INPUT_ARCHITECTURE = 'architecture';
export const INPUT_JAVA_PACKAGE = 'java-package';
export const INPUT_DISTRIBUTION = 'distribution';
export const INPUT_JDK_FILE = 'jdk-file';
export const INPUT_JDK_FILE_DEPRECATED = 'jdkFile';
export const INPUT_CHECK_LATEST = 'check-latest';
export const INPUT_SET_DEFAULT = 'set-default';
export const INPUT_VERIFY_SIGNATURE = 'verify-signature';
export const INPUT_VERIFY_SIGNATURE_PUBLIC_KEY = 'verify-signature-public-key';
export const INPUT_SERVER_ID = 'server-id';
export const INPUT_SERVER_USERNAME = 'server-username';
export const INPUT_SERVER_PASSWORD = 'server-password';
export const INPUT_SETTINGS_PATH = 'settings-path';
export const INPUT_OVERWRITE_SETTINGS = 'overwrite-settings';
export const INPUT_GPG_PRIVATE_KEY = 'gpg-private-key';
export const INPUT_GPG_PASSPHRASE = 'gpg-passphrase';

export const INPUT_DEFAULT_GPG_PRIVATE_KEY = undefined;
export const INPUT_DEFAULT_GPG_PASSPHRASE = 'GPG_PASSPHRASE';

// The default name of the environment variable the maven-gpg-plugin reads the
// passphrase from (property `gpg.passphraseEnvName`). When the configured
// passphrase env var name matches this, no extra configuration is required.
export const MAVEN_GPG_PASSPHRASE_DEFAULT_ENV = 'MAVEN_GPG_PASSPHRASE';

// Id of the settings.xml profile used to set `gpg.passphraseEnvName`.
export const GPG_PASSPHRASE_PROFILE_ID = 'setup-java-gpg';

export const INPUT_CACHE = 'cache';
export const INPUT_CACHE_DEPENDENCY_PATH = 'cache-dependency-path';
export const INPUT_JOB_STATUS = 'job-status';

export const STATE_GPG_PRIVATE_KEY_FINGERPRINT = 'gpg-private-key-fingerprint';

export const M2_DIR = '.m2';
export const MVN_SETTINGS_FILE = 'settings.xml';
export const MVN_TOOLCHAINS_FILE = 'toolchains.xml';
export const INPUT_MVN_TOOLCHAIN_ID = 'mvn-toolchain-id';
export const INPUT_MVN_TOOLCHAIN_VENDOR = 'mvn-toolchain-vendor';
export const INPUT_SHOW_DOWNLOAD_PROGRESS = 'show-download-progress';

export const MAVEN_ARGS_ENV = 'MAVEN_ARGS';
export const MAVEN_NO_TRANSFER_PROGRESS_FLAG = '-ntp';
export const MAVEN_NO_TRANSFER_PROGRESS_LONG_FLAG = '--no-transfer-progress';

export const DISTRIBUTIONS_ONLY_MAJOR_VERSION = ['corretto'];
