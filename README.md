# Setup Java

[![Basic validation](https://github.com/actions/setup-java/actions/workflows/basic-validation.yml/badge.svg?branch=main)](https://github.com/actions/setup-java/actions/workflows/basic-validation.yml)
[![Validate Java e2e](https://github.com/actions/setup-java/actions/workflows/e2e-versions.yml/badge.svg?branch=main)](https://github.com/actions/setup-java/actions/workflows/e2e-versions.yml)
[![Validate cache](https://github.com/actions/setup-java/actions/workflows/e2e-cache.yml/badge.svg?branch=main)](https://github.com/actions/setup-java/actions/workflows/e2e-cache.yml)

Set up Java for GitHub Actions workflows. `setup-java` installs a requested Java distribution, adds it to `PATH`, configures `JAVA_HOME`, and can optionally cache build dependencies for Apache Maven, Gradle, and sbt; generate Maven publishing configuration, verify JDK package signatures, manage multiple JDKs, and manage Maven toolchains.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v5
    with:
      distribution: temurin
      java-version: '25'
  - run: java --version
```

> [!NOTE]
> V6 is still in development on the `main` branch and is not yet recommended for production workflows. To use it, you must explicitly reference the `main` branch in your workflow, as in 
>
> ```yaml
> - uses: actions/setup-java@main
> ```
> 
> For production workflows, it is recommended to use the latest stable release `v5`.

## Contents

- [What it does](#what-it-does)
- [What's new](#whats-new)
- [Usage](#usage)
- [Inputs](#inputs)
- [Supported distributions](#supported-distributions)
- [Supported version syntax](#supported-version-syntax)
- [Caching dependencies](#caching-dependencies)
- [Multiple JDKs and Maven toolchains](#multiple-jdks-and-maven-toolchains)
- [Publishing packages](#publishing-packages)
- [Advanced usage](#advanced-usage)

## What it does

- Downloads and installs Java from a supported distribution.
- Uses a requested Java version, a version file, or the `latest` stable release alias.
- Extracts and caches a custom JDK archive from a local file.
- Configures Maven `settings.xml`, Maven Toolchains, Maven GPG signing inputs, and environment-variable based credentials for publishing workflows.
- Registers Java problem matchers for compiler diagnostics and uncaught exceptions.
- Caches dependencies for Maven, Gradle, and sbt.
- Verifies downloaded archive checksums when a distribution publishes authoritative checksums.
- Optionally verifies package signatures for supported distributions.

`setup-java` works with Java, Scala, Kotlin, Gradle, Maven, and sbt projects.

## What's new

### V6 (in development)

- Migrated the action implementation to ESM to support the latest `@actions/*` packages.
- Added the `oracle-openjdk` distribution for OpenJDK builds from Oracle.
- Added `java-version: latest` to resolve the newest stable GA release from the distribution's remote metadata.
- JDK downloads now automatically verify authoritative checksums for [supported distributions](#download-integrity-and-signatures).
- Added `force-download: true` to bypass the tool cache and perform a reproducible fresh install.
- Dependency caching now supports custom paths with `cache-path` and restore-only operation with `cache-read-only: true`.
- Set `problem-matcher: false` to disable Java compiler and uncaught-exception annotations.
- GraalVM distributions now set `GRAALVM_HOME` in addition to `JAVA_HOME`.
- Invalid boolean values, unsupported distribution/package/platform combinations, and mismatched Maven toolchain ID counts now fail with targeted errors.
- Renamed environment-variable-name inputs so they are not mistaken for secret values:
  - `server-username` -> `server-username-env-var`
  - `server-password` -> `server-password-env-var`
  - `gpg-passphrase` -> `gpg-passphrase-env-var`
- Deprecated aliases still work, but emit warnings.
- Maven GPG passphrases are now passed through `gpg.passphraseEnvName` instead of a deprecated `gpg.passphrase` server entry in `settings.xml`. This requires `maven-gpg-plugin` 3.2.0 or newer. See [GPG](docs/advanced-usage.md#gpg).
- Legacy AdoptOpenJDK distributions were removed. Use `temurin` instead of `adopt` or `adopt-hotspot`, and `semeru` instead of `adopt-openj9`.

### V5

- Upgraded the action runtime from Node 20 to Node 24. Self-hosted runners must use version `v2.327.1` or later. See the [runner release notes](https://github.com/actions/runner/releases/tag/v2.327.1).
- Added support for [GraalVM Community](#supported-distributions) and [Tencent Kona](#supported-distributions).
- Expanded `java-version-file` support with `.sdkmanrc` files and automatic distribution detection from SDKMAN and asdf vendor identifiers.
- Added optional package-signature verification for Eclipse Temurin and Microsoft Build of OpenJDK downloads.
- Added `set-default: false` for installing a JDK without changing `JAVA_HOME` or `PATH`.
- Improved dependency caching with separate Maven and Gradle wrapper caches, Maven extension-aware cache keys, and the `cache-primary-key` output.
- Improved Maven and Java build behavior by preserving toolchain entries across repeated action invocations, suppressing transfer progress by default, generating non-interactive Maven settings, and matching `javac` compiler errors.
- Renamed the `jdkFile` input to `jdk-file`; the old name remains available as a deprecated alias.
- See the [complete V5 release history](https://github.com/actions/setup-java/releases?q=v5&expanded=true) for enhancements and fixes across all V5 releases.

### Older versions

> [!WARNING]
> `actions/setup-java` versions `v1` through `v4` are deprecated. Upgrade workflows to `actions/setup-java@v5`, the latest stable release.

## Usage

### Install Eclipse Temurin

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v5
    with:
      distribution: temurin
      java-version: '25'
  - run: java --version
```

### Install Microsoft Build of OpenJDK

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v5
    with:
      distribution: microsoft
      java-version: '25'
  - run: java --version
```

### Read the version from a file

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v5
    with:
      distribution: temurin
      java-version-file: .java-version
  - run: java --version
```

Supported version files are `.java-version`, `.tool-versions`, and `.sdkmanrc`. A `.sdkmanrc` file can also provide the distribution when it contains a recognized suffix, such as `java=21.0.5-tem`.

### Use the newest stable Java

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v5
    with:
      distribution: temurin
      java-version: latest
  - run: java --version
```

`latest` always resolves from the distribution's remote metadata and uses the newest stable GA release. It is not supported with `java-version-file`, early-access versions, or `distribution: jdkfile`.

## Inputs

| Input | Description | Default |
| --- | --- | --- |
| `java-version` | Java version to install. Supports whole versions, semver ranges, early-access versions, and `latest`. Required unless `java-version-file` is set. | |
| `java-version-file` | Path to `.java-version`, `.tool-versions`, or `.sdkmanrc`. Used when `java-version` is not set. | |
| `distribution` | Java distribution keyword. Values are case-sensitive and must match one of the supported keywords below. Required unless `java-version-file` points to `.sdkmanrc` with a recognized distribution suffix. | |
| `java-package` | Package variant such as `jdk`, `jre`, `jdk+fx`, `jre+fx`, `jdk+crac`, `jre+crac`, `jdk+jmods`, `jdk+jcef`, `jre+jcef`, `jdk+ft`, or `jre+ft`. Support varies by distribution. | `jdk` |
| `architecture` | Package architecture. Canonical values are `x86`, `x64`, `armv7`, `aarch64`, `ppc64le`, `ppc64`, and `s390x`. Aliases `ia32`, `amd64`, `arm`, and `arm64` are normalized. | Runner architecture |
| `jdk-file` | Local compressed JDK archive. Requires `distribution: jdkfile`. | |
| `check-latest` | Check remote metadata for the latest version satisfying the version spec before using the runner tool cache. | `false` |
| `force-download` | Always download Java and replace any matching version in the tool cache. | `false` |
| `set-default` | Add Java to `PATH` and set `JAVA_HOME`. When `false`, only version-specific `JAVA_HOME_<major>_<arch>` variables are set. | `true` |
| `problem-matcher` | Register Java compiler and uncaught exception problem matchers. | `true` |
| `verify-signature` | Verify downloaded Java package signatures when supported. Currently supported for `temurin` and `microsoft`. | `false` |
| `verify-signature-public-key` | ASCII-armored GPG public key to use for signature verification. Overrides the bundled key. | |
| `token` | Token for fetching GitHub.com-hosted version manifests, useful on GitHub Enterprise Server when unauthenticated requests are rate-limited. | `${{ github.token }}` on GitHub.com; empty string on GHES |
| `cache` | Enable dependency caching for `maven`, `gradle`, or `sbt`. | |
| `cache-jdk` | Cache downloaded JDK installations between jobs. When omitted, JDK caching is enabled only if `cache` is set. Set explicitly to `true` or `false` to override. | Enabled when `cache` is set |
| `cache-dependency-path` | Dependency file paths used for cache key hashing. Supports globs and multiline values. | Auto-detected by package manager |
| `cache-path` | Cache paths to use instead of the package manager's default dependency cache path. Supports multiline values and exclusions. | |
| `cache-read-only` | Restore dependency, wrapper, and JDK caches without saving changes in the post step. | `false` |
| `server-id` | Maven repository ID used in generated `settings.xml`. | `github` |
| `server-username-env-var` | Environment variable name for Maven repository username. | `GITHUB_ACTOR` |
| `server-password-env-var` | Environment variable name for Maven repository password or token. | `GITHUB_TOKEN` |
| `settings-path` | Directory where `settings.xml` is written. | `~/.m2` |
| `overwrite-settings` | Overwrite an existing `settings.xml`. | `true` |
| `gpg-private-key` | GPG private key to import. | |
| `gpg-passphrase-env-var` | Environment variable name for the GPG private key passphrase. | `GPG_PASSPHRASE` when a key is set |
| `mvn-toolchain-id` | Maven Toolchain ID. When multiple Java versions are installed, the number of IDs must match the number of versions. | `${distribution}_${java-version}` |
| `mvn-toolchain-vendor` | Maven Toolchain vendor value. | `${distribution}` |
| `show-download-progress` | Keep Maven artifact download and transfer progress in logs. When `false`, the action adds `-ntp` to `MAVEN_ARGS`. | `false` |

- `java-package`: Supported package types are `jdk`, `jre`, `jdk+fx`, `jre+fx`, `jdk+crac`, `jre+crac`, `jdk+jmods`, `jdk+jcef`, `jre+jcef`, `jdk+ft`, and `jre+ft`. Availability varies by distribution.

Deprecated aliases `jdkFile`, `server-username`, `server-password`, and `gpg-passphrase` remain accepted for compatibility, but should be replaced with the current input names.

## Outputs

| Output | Description |
| --- | --- |
| `distribution` | Distribution that was installed. |
| `version` | Actual Java version that was installed. |
| `path` | Installation path, also used for `JAVA_HOME` when `set-default` is enabled. |
| `cache-hit` | Whether an exact dependency cache match was restored. |
| `cache-primary-key` | Primary cache key computed for the selected package manager. Empty when caching is disabled or skipped. |

## Supported distributions

| Keyword | Distribution | License |
| --- | --- | --- |
| `corretto` | [Amazon Corretto](https://aws.amazon.com/corretto/) | [License](https://aws.amazon.com/corretto/faqs/) |
| `dragonwell` | [Alibaba Dragonwell JDK](https://dragonwell-jdk.io/) | [License](https://www.aliyun.com/product/dragonwell/) |
| `graalvm` | [Oracle GraalVM](https://www.graalvm.org/) | [License](https://www.oracle.com/downloads/licenses/graal-free-license.html) |
| `graalvm-community` | [GraalVM Community](https://github.com/graalvm/graalvm-ce-builds/releases) | [License](https://github.com/oracle/graal/blob/master/LICENSE) |
| `jetbrains` | [JetBrains Runtime](https://github.com/JetBrains/JetBrainsRuntime/) | [License](https://github.com/JetBrains/JetBrainsRuntime/blob/main/LICENSE) |
| `kona` | [Tencent Kona JDK](https://tencent.github.io/konajdk/) | [License](https://tencent.github.io/konajdk/LICENSE.txt) |
| `liberica` | [Liberica JDK](https://bell-sw.com/) | [License](https://bell-sw.com/liberica_eula/) |
| `liberica-nik` | [Liberica Native Image Kit](https://bell-sw.com/pages/downloads/native-image-kit/) | [License](https://bell-sw.com/liberica_nik_eula/) |
| `microsoft` | [Microsoft Build of OpenJDK](https://www.microsoft.com/openjdk) | [License](https://docs.microsoft.com/java/openjdk/faq) |
| `oracle` | [Oracle JDK](https://www.oracle.com/java/technologies/downloads/) | [License](https://java.com/freeuselicense) |
| `oracle-openjdk` | [Oracle OpenJDK](https://jdk.java.net/) | [License](https://openjdk.org/legal/gplv2+ce.html) |
| `sapmachine` | [SAP SapMachine JDK/JRE](https://sapmachine.io/) | [License](https://github.com/SAP/SapMachine/blob/sapmachine/LICENSE) |
| `semeru` | [IBM Semeru Runtime Open Edition](https://developer.ibm.com/languages/java/semeru-runtimes/downloads/) | [License](https://openjdk.java.net/legal/gplv2+ce.html) |
| `temurin` | [Eclipse Temurin](https://adoptium.net/) | [License](https://adoptium.net/about.html) |
| `zulu` | [Azul Zulu OpenJDK](https://www.azul.com/downloads/zulu-community/?package=jdk) | [License](https://www.azul.com/products/zulu-and-zulu-enterprise/zulu-terms-of-use/) |
| `jdkfile` | Custom JDK archive | |

> [!NOTE]
> Distribution availability, package variants, architectures, and version metadata differ by vendor. Check the vendor documentation when a specific version or platform matters.

Additional distribution notes:

- Oracle OpenJDK builds are archived after a limited number of releases and no longer receive security updates. To continue receiving security patches, use Oracle JDK or another vendor.
- Azul Zulu maps `arm64` to `aarch64` when querying the Azul Metadata API.
- GraalVM Community is available as `distribution: graalvm-community` for stable JDK 17 and later releases.
- On Ubuntu runners, commands executed with `sudo` do not inherit the `JAVA_HOME` and `PATH` set by `setup-java` and may fall back to the system-default JDK.

## Supported version syntax

`java-version` accepts exact versions, version ranges, early-access versions, and `latest`.

| Syntax | Examples |
| --- | --- |
| Major version | `8`, `11`, `17`, `21`, `25` |
| Specific feature or patch version | `11.0`, `11.0.4`, `17.0`, `8.0.282+8` |
| JEP 322 multi-field versions | `11.0.9.1`, `18.0.1.1` |
| Early access | `15-ea`, `15.0.0-ea`, `27-ea` |
| Latest stable GA release | `latest` |

When `check-latest` is `false`, the action first tries the runner tool cache for the requested distribution, package type, architecture, and version range. It downloads Java only when no matching cached version is found. When `check-latest` is `true`, the action checks remote metadata first and downloads if the cached version is not current.

GitHub-hosted runners primarily pre-cache Eclipse Temurin JDKs. See the installed Java versions for [Ubuntu](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md#java), [Windows](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md#java), and [macOS](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md#java). On a fresh GitHub-hosted runner, requests for other distributions usually miss the tool cache and resolve from remote metadata. For broad version ranges such as a major version (`21`, `25`), this often behaves similarly to `check-latest: true` because the action downloads the latest available release that satisfies the range.

## Download integrity and signatures

`setup-java` automatically verifies downloaded archive checksums when a selected distribution publishes an authoritative checksum. Automatic checksum verification currently applies to `temurin`, `semeru`, `corretto`, `dragonwell`, `kona`, `sapmachine`, `graalvm`, `graalvm-community`, `zulu`, `oracle`, `oracle-openjdk`, `microsoft`, and `jetbrains`.

Distributions or individual releases without an authoritative checksum continue to install normally, with the omission reported in debug logs. Archives resolved directly from the runner tool cache are not downloaded again and are not reverified.

Use `verify-signature: true` to verify package signatures for distributions that support it. Currently supported distributions are `temurin` and `microsoft`; setting it for an unsupported distribution fails the workflow.

## Caching dependencies

Downloaded JDK installations can be cached independently of dependency caching.
When `cache-jdk` is omitted, dependency `cache` implicitly enables it. Set
`cache-jdk: true` to enable JDK caching independently, or `cache-jdk: false` to
opt out while retaining dependency caching.

> [!IMPORTANT]
> Review [Caching JDK installations](docs/advanced-usage.md#caching-jdk-installations)
> for the full behavior, cache identity and storage impact before enabling it.

Set `cache` to `maven`, `gradle`, or `sbt` to cache dependencies with minimal configuration.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v5
    with:
      distribution: temurin
      java-version: '25'
      cache: maven
  - run: mvn verify
```

The primary dependency cache key is `setup-java-<runner-os>-<node-arch>-<package-manager>-<file-hash>`, where `<node-arch>` is the runner's Node.js process architecture. The primary cache stores dependency directories such as `~/.m2/repository`, `~/.gradle/caches`, or the sbt cache paths. Its file hash is based on these files by default:

| Package manager | Files used for the primary dependency-cache key |
| --- | --- |
| Gradle | `**/*.gradle*`, `**/gradle-wrapper.properties`, `buildSrc/**/Versions.kt`, `buildSrc/**/Dependencies.kt`, `gradle/*.versions.toml`, `**/versions.properties` |
| Maven | `**/pom.xml`, `**/.mvn/wrapper/maven-wrapper.properties`, `**/.mvn/extensions.xml` |
| sbt | `**/*.sbt`, `**/project/build.properties`, `**/project/**.scala`, `**/project/**.sbt` |

Use `cache-dependency-path` to override the files used for key hashing, especially in monorepos:

```yaml
- uses: actions/setup-java@v5
  with:
    distribution: temurin
    java-version: '25'
    cache: gradle
    cache-dependency-path: |
      sub-project/*.gradle*
      sub-project/**/gradle-wrapper.properties
```

Use `cache-path` when the build tool stores dependencies outside the default location:

```yaml
- uses: actions/setup-java@v5
  with:
    distribution: temurin
    java-version: '25'
    cache: maven
    cache-path: |
      /custom/maven/repository
      !/custom/maven/repository/**/*.lastUpdated
- run: mvn -Dmaven.repo.local=/custom/maven/repository verify
```

`cache-path` changes what is restored and saved, but not the cache key. Jobs that should share a cache key must use the same OS, architecture, package manager, dependency files, and cache paths.

### Read-only caches

Set `cache-read-only: true` to restore dependency, wrapper, and JDK caches without saving changes in the post action. This is useful for pull requests, merge queues, short-lived branches, and matrix fan-out jobs that should only consume caches produced elsewhere.

```yaml
- uses: actions/setup-java@v5
  with:
    distribution: temurin
    java-version: '25'
    cache: maven
    cache-read-only: ${{ github.ref != 'refs/heads/main' }}
```

For matrix fan-out, seed the cache once and make matrix jobs read-only consumers:

```yaml
jobs:
  seed-cache:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '25'
          cache: maven
      - run: mvn dependency:go-offline dependency:resolve-plugins

  build:
    needs: seed-cache
    runs-on: ubuntu-latest
    strategy:
      matrix:
        goal: [test, verify, package]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '25'
          cache: maven
          cache-read-only: true
      - run: mvn ${{ matrix.goal }}
```

### Wrapper caches

Maven and Gradle wrapper distributions are restored and saved as additional cache entries, separate from the primary dependency cache. These entries have their own keys in the form `setup-java-<runner-os>-<node-arch>-<wrapper-cache-name>-<file-hash>`.

| Package manager | Wrapper cache name | Cached path | Files used for wrapper-cache key |
| --- | --- | --- | --- |
| Maven | `maven-wrapper` | `~/.m2/wrapper/dists` | `**/.mvn/wrapper/maven-wrapper.properties` |
| Gradle | `gradle-wrapper` | `~/.gradle/wrapper` | `**/gradle-wrapper.properties` |

These wrapper caches are independent from dependency caches, so they remain useful even when dependency files change frequently. The wrapper properties are also part of the Maven and Gradle primary dependency-cache key because wrapper changes can affect how dependencies are resolved, but the wrapper distribution files themselves are stored in the separate wrapper cache entries above.

For advanced Gradle caching features such as build output caching, configuration cache support, encrypted cache storage, cleanup, and fine-grained cache control, consider [`gradle/actions/setup-gradle`](https://github.com/gradle/actions/tree/main/setup-gradle).

### Cache segment restore timeout

Cache downloads are split into segments. To reduce the chance of a stuck segment blocking a workflow, set `SEGMENT_DOWNLOAD_TIMEOUT_MINS`:

```yaml
env:
  SEGMENT_DOWNLOAD_TIMEOUT_MINS: '5'
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v5
    with:
      distribution: temurin
      java-version: '25'
      cache: gradle
  - run: ./gradlew build --no-daemon
```

## Multiple JDKs and Maven toolchains

Install multiple Java versions by providing a multiline `java-version` value. All configured JDKs are installed. The last one added to `PATH` becomes the default.

```yaml
steps:
  - uses: actions/setup-java@v5
    with:
      distribution: temurin
      java-version: |
        8
        11
        17
        21
        25
```

Other installed JDKs are available through version-specific variables such as `JAVA_HOME_17_X64`. To use a specific version later in the job, set `JAVA_HOME` and prepend its `bin` directory to `PATH`.

`setup-java` writes a Maven Toolchains declaration for each installed JDK. When multiple JDKs are installed, the declaration contains all of them. Customize the generated toolchain values with `mvn-toolchain-id` and `mvn-toolchain-vendor`.

## Testing with a Java matrix

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        java: ['8', '11', '17', '21', '25']
    name: Java ${{ matrix.java }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: ${{ matrix.java }}
      - run: java --version
      - run: mvn verify
```

## Publishing packages

`setup-java` generates Maven `settings.xml` and Maven Toolchains configuration. For Gradle publishing, it installs Java for the workflow; the Gradle build file remains responsible for reading credentials from environment variables.

### Maven

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v5
    with:
      distribution: temurin
      java-version: '25'
      server-id: github
      server-username-env-var: GITHUB_ACTOR
      server-password-env-var: GITHUB_TOKEN
  - run: mvn --batch-mode deploy
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GPG signing

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v5
    with:
      distribution: temurin
      java-version: '25'
      gpg-private-key: ${{ secrets.GPG_PRIVATE_KEY }}
      gpg-passphrase-env-var: GPG_PASSPHRASE
  - run: mvn --batch-mode deploy
    env:
      GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
```

Maven GPG signing requires `maven-gpg-plugin` 3.2.0 or newer because `setup-java` passes the passphrase through `gpg.passphraseEnvName`.

## Recommended permissions

When using the `setup-java` action in your GitHub Actions workflow, it is recommended to set the following permissions to ensure proper functionality:

```yaml
permissions:
  contents: read # access to check out code and install dependencies
```

Publishing workflows may require additional permissions depending on the target registry.

## Advanced usage

See [advanced usage](docs/advanced-usage.md) for detailed examples:

- [Selecting a Java distribution](docs/advanced-usage.md#selecting-a-java-distribution)
- [Installing custom Java package types](docs/advanced-usage.md#installing-custom-java-package-type)
- [Package compatibility](docs/advanced-usage.md#package-compatibility)
- [Ensuring the Maven cache is complete](docs/advanced-usage.md#ensuring-the-maven-cache-is-complete-plugin-dependencies)
- [Installing custom Java architecture](docs/advanced-usage.md#installing-custom-java-architecture)
- [Installing a JDK without setting it as default](docs/advanced-usage.md#installing-jdk-without-setting-as-default)
- [Installing Java from a local file](docs/advanced-usage.md#installing-java-from-local-file)
- [Testing against different Java distributions](docs/advanced-usage.md#testing-against-different-java-distributions)
- [Testing against different platforms](docs/advanced-usage.md#testing-against-different-platforms)
- [Publishing using Apache Maven](docs/advanced-usage.md#publishing-using-apache-maven)
- [Maven transfer progress](docs/advanced-usage.md#maven-transfer-progress-download-logs)
- [Publishing using Gradle](docs/advanced-usage.md#publishing-using-gradle)
- [Hosted tool cache](docs/advanced-usage.md#hosted-tool-cache)
- [Modifying Maven Toolchains](docs/advanced-usage.md#modifying-maven-toolchains)
- [Java version files](docs/advanced-usage.md#java-version-file)
- [Self-signed certificates and internal CAs on GitHub Enterprise](docs/advanced-usage.md#self-signed-certificates-and-internal-cas-github-enterprise)

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

## Contributions

Contributions are welcome. See our [Contributor's Guide](docs/contributors.md).

## Code of Conduct

:wave: Be nice. See [our code of conduct](CODE_OF_CONDUCT.md)
