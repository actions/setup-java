# Setup Java

[![Basic validation](https://github.com/actions/setup-java/actions/workflows/basic-validation.yml/badge.svg?branch=main)](https://github.com/actions/setup-java/actions/workflows/basic-validation.yml)
[![Validate Java e2e](https://github.com/actions/setup-java/actions/workflows/e2e-versions.yml/badge.svg?branch=main)](https://github.com/actions/setup-java/actions/workflows/e2e-versions.yml)
[![Validate cache](https://github.com/actions/setup-java/actions/workflows/e2e-cache.yml/badge.svg?branch=main)](https://github.com/actions/setup-java/actions/workflows/e2e-cache.yml)

The `setup-java` action provides the following functionality for GitHub Actions runners:
- Downloading and setting up a requested version of Java. See [Usage](#usage) for a list of supported distributions.
- Extracting and caching custom version of Java from a local file.
- Configuring runner for publishing using Apache Maven.
- Configuring runner for publishing using Gradle.
- Configuring runner for using GPG private key.
- Registering problem matchers for error output.
- Caching dependencies managed by Apache Maven.
- Caching dependencies managed by Gradle.
- Caching dependencies managed by sbt.
- [Maven Toolchains declaration](https://maven.apache.org/guides/mini/guide-using-toolchains.html) for specified JDK versions.

This action allows you to work with Java and Scala projects.

## What's new in V6

> [!NOTE]
> V6 is still in development (`main` branch) and is not yet recommended for production workflows.

- **Migrated to ESM** to enable support for the latest `@actions/*` package versions. This is an internal implementation change only. No changes are required to your workflow configuration, and the action's behavior is unchanged. Existing workflows continue to work as before.

## Breaking changes in V6

- **The GPG passphrase is now passed to the Maven GPG Plugin through an environment variable (`gpg.passphraseEnvName`) instead of the deprecated `gpg.passphrase` server in `settings.xml`.** The `gpg-passphrase` input and its default (`GPG_PASSPHRASE`) are unchanged, so if you already set that environment variable in your build step your workflow keeps working. However, this now requires `maven-gpg-plugin` **3.2.0 or newer**; older versions do not honor `gpg.passphraseEnvName` and, because the `gpg.passphrase` server is no longer written, will not pick up the passphrase. Upgrade the plugin to 3.2.0+.

  See [GPG](docs/advanced-usage.md#gpg) for details.

## Breaking changes in V5

- Upgraded action from node20 to node24
  > Make sure your runner is on version v2.327.1 or later to ensure compatibility with this release [Release Notes](https://github.com/actions/runner/releases/tag/v2.327.1)

For more details,  see the full release notes on the [releases page](https://github.com/actions/setup-java/releases/tag/v5.0.0)

## Usage

    - `java-version`: The Java version that is going to be set up. Takes a whole or [semver](#supported-version-syntax) Java version. If not specified, the action will expect `java-version-file` input to be specified.

    - `java-version-file`: The path to a file containing java version. Supported file types are `.java-version`, `.tool-versions`, and `.sdkmanrc`. See more details in [about .java-version-file](docs/advanced-usage.md#Java-version-file).

    - `distribution`: Java [distribution](#supported-distributions). Required unless `java-version-file` points to `.sdkmanrc` with a recognized distribution suffix (for example `java=21.0.5-tem`).

    - `java-package`: The packaging variant of the chosen distribution. Possible values: `jdk`, `jre`, `jdk+fx`, `jre+fx`. For Azul Zulu, `jdk+crac` and `jre+crac` are also supported. Default value: `jdk`.

    - `architecture`: The target architecture of the package. Possible values: `x86`, `x64`, `armv7`, `aarch64`, `ppc64le`. Default value: Derived from the runner machine.

    - `jdk-file`: If a use-case requires a custom distribution setup-java uses the compressed JDK from the location pointed by this input and will take care of the installation and caching on the VM. Note: `distribution` must be set to 'jdkfile' (case-sensitive; all lowercase) when using this option. (The camelCase `jdkFile` input is still accepted as a deprecated alias and may be removed in a future release.)

    - `check-latest`: Setting this option makes the action to check for the latest available version for the version spec.

    - `set-default`: Set to `false` to install a JDK without making it the default. When `false`, `JAVA_HOME` and `PATH` are not updated, but `JAVA_HOME_<major>_<arch>` is still set so the JDK remains discoverable. Default value: `true`. See [Installing JDK without setting as default](docs/advanced-usage.md#Installing-JDK-without-setting-as-default) for more details.

    - `problem-matcher`: Set to `false` to disable Java problem matcher annotations (compiler diagnostics and uncaught exceptions). Default value: `true`. See [Java problem matcher](docs/advanced-usage.md#java-problem-matcher-compiler-annotations) for details and annotation limits.

    - `verify-signature`: Verifies downloaded Java package signatures when supported by the selected distribution. Currently supported for `temurin` and `microsoft`. If set to `true` for unsupported distributions, the action fails.

    - `verify-signature-public-key`: ASCII-armored GPG public key used to verify the downloaded package signature. Overrides the default bundled key for the selected distribution.

    - `token`: The token used to authenticate when fetching version manifests hosted on GitHub.com. Defaults to `${{ github.token }}` when running on GitHub.com; defaults to an empty string on GitHub Enterprise Server. On GHES, provide a GitHub.com personal access token if manifest requests are rate-limited. See [Using Microsoft distribution on GHES](docs/advanced-usage.md#using-microsoft-distribution-on-ghes) for more details.

    - `cache`: Quick [setup caching](#caching-packages-dependencies) for the dependencies managed through one of the predefined package managers. It can be one of "maven", "gradle" or "sbt".

    - `cache-dependency-path`: The path to a dependency file: pom.xml, build.gradle, build.sbt, etc. This option can be used with the `cache` option. If this option is omitted, the action searches for the dependency file in the entire repository. This option supports wildcards and a list of file names for caching multiple dependencies.

  #### Maven options
  The action has a bunch of inputs to generate maven's [settings.xml](https://maven.apache.org/settings.html) on the fly and pass the values to Apache Maven GPG Plugin as well as Apache Maven Toolchains. See [advanced usage](docs/advanced-usage.md) for more.

    - `overwrite-settings`: By default action overwrites the settings.xml. In order to skip generation of file if it exists, set this to `false`.

    - `server-id`: ID of the distributionManagement repository in the pom.xml file. Default is `github`.

    - `server-username`: Environment variable name for the username for authentication to the Apache Maven repository. Default is GITHUB\_ACTOR.

    - `server-password`: Environment variable name for password or token for authentication to the Apache Maven repository. Default is GITHUB\_TOKEN.

    - `settings-path`: Maven related setting to point to the directory where the settings.xml file will be written. Default is \~/.m2.

    - `gpg-private-key`: GPG private key to import. Default is empty string.

    - `gpg-passphrase`: Environment variable name for the GPG private key passphrase. Default is GPG\_PASSPHRASE.

    - `mvn-toolchain-id`: Name of Maven Toolchain ID if the default name of `${distribution}_${java-version}` is not wanted.

    - `mvn-toolchain-vendor`: Name of Maven Toolchain Vendor if the default name of `${distribution}` is not wanted.

    - `show-download-progress`: Set to `true` to keep Maven artifact download and transfer progress in build logs. Default value: `false`. By default, the action adds `-ntp` (`--no-transfer-progress`) to `MAVEN_ARGS`. This input has no effect on non-Maven builds. See [Maven transfer progress](docs/advanced-usage.md#maven-transfer-progress-download-logs) for more details.

### Basic Configuration

#### Eclipse Temurin
```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin' # See 'Supported distributions' for available options
      java-version: '25'
  - run: java --version
```

#### Azul Zulu OpenJDK
```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'zulu' # See 'Supported distributions' for available options
      java-version: '25'
  - run: java --version
```

#### Supported version syntax
The `java-version` input supports an exact version or a version range using [SemVer](https://semver.org/) notation. The values below are examples, not an exhaustive list:
- major versions, such as: `8`, `11`, `16`, `17`, `21`, `25`
- more specific versions: `8.0.282+8`, `8.0.232`, `11.0`, `11.0.4`, `17.0`
- multi-field Java versions (JEP 322), such as: `11.0.9.1`, `18.0.1.1`
- early access (EA) versions: `15-ea`, `15.0.0-ea`
- the `latest` alias, which floats to the newest available stable (GA) release

> [!NOTE]
> - `latest` always resolves the newest version from the distribution's remote metadata (it behaves like `check-latest: true`), so it ignores any older version already present in the runner tool cache. This has the same performance trade-off described in [Check latest](#check-latest).
> - `latest` is only supported through the `java-version` input, not through `java-version-file`, and it resolves stable (GA) releases only — it cannot be combined with `-ea`.
> - The `jdkfile` distribution does not support `latest`, as it installs from a local file.
> - For `oracle` and `graalvm` (Oracle GraalVM), `latest` uses the Adoptium API only to determine the newest GA **major version number** — the JDK binary itself is still downloaded from the Oracle / GraalVM servers for that major. Because these distributions have no endpoint to list their own releases, if their servers haven't published the resolved major yet, the action fails and asks you to specify a concrete version. Note the Oracle JDK license caveat below still applies to a floating `latest`.
> - For `graalvm-community`, `latest` floats to the newest GA release published on GitHub, so it never depends on the Adoptium API and always resolves to the newest major that GraalVM Community actually ships.

#### Supported distributions
Currently, the following distributions are supported:
| Keyword | Distribution / Official site | License
|-|-|-|
| `temurin` | [Eclipse Temurin](https://adoptium.net/) | [`temurin` license](https://adoptium.net/about.html)
| `zulu` | [Azul Zulu OpenJDK](https://www.azul.com/downloads/zulu-community/?package=jdk) | [`zulu` license](https://www.azul.com/products/zulu-and-zulu-enterprise/zulu-terms-of-use/) |
| `adopt` or `adopt-hotspot` | [AdoptOpenJDK Hotspot](https://adoptopenjdk.net/) | [`adopt-hotspot` license](https://adoptopenjdk.net/about.html) |
| `adopt-openj9` | [AdoptOpenJDK OpenJ9](https://adoptopenjdk.net/) | [`adopt-openj9` license](https://adoptopenjdk.net/about.html) |
| `liberica` | [Liberica JDK](https://bell-sw.com/) | [`liberica` license](https://bell-sw.com/liberica_eula/) |
| `liberica-nik` | [Liberica Native Image Kit](https://bell-sw.com/pages/downloads/native-image-kit/) | [`liberica-nik` license](https://bell-sw.com/liberica_nik_eula/) |
| `microsoft` | [Microsoft Build of OpenJDK](https://www.microsoft.com/openjdk) | [`microsoft` license](https://docs.microsoft.com/java/openjdk/faq)
| `corretto` | [Amazon Corretto Build of OpenJDK](https://aws.amazon.com/corretto/) | [`corretto` license](https://aws.amazon.com/corretto/faqs/)
| `semeru` | [IBM Semeru Runtime Open Edition](https://developer.ibm.com/languages/java/semeru-runtimes/downloads/) | [`semeru` license](https://openjdk.java.net/legal/gplv2+ce.html) |
| `oracle` | [Oracle JDK](https://www.oracle.com/java/technologies/downloads/) | [`oracle` license](https://java.com/freeuselicense)
| `dragonwell` | [Alibaba Dragonwell JDK](https://dragonwell-jdk.io/) | [`dragonwell` license](https://www.aliyun.com/product/dragonwell/)
| `sapmachine` | [SAP SapMachine JDK/JRE](https://sapmachine.io/) | [`sapmachine` license](https://github.com/SAP/SapMachine/blob/sapmachine/LICENSE)
| `graalvm` | [Oracle GraalVM](https://www.graalvm.org/) | [`graalvm` license](https://www.oracle.com/downloads/licenses/graal-free-license.html)
| `graalvm-community` | [GraalVM Community](https://github.com/graalvm/graalvm-ce-builds/releases) | [`graalvm-community` license](https://github.com/oracle/graal/blob/master/LICENSE)
| `jetbrains` | [JetBrains Runtime](https://github.com/JetBrains/JetBrainsRuntime/) | [`jetbrains` license](https://github.com/JetBrains/JetBrainsRuntime/blob/main/LICENSE)
| `kona` | [Tencent Kona JDK](https://tencent.github.io/konajdk/) | [`kona` license](https://tencent.github.io/konajdk/LICENSE.txt)
| `jdkfile` | Custom JDK Installation | |

> [!NOTE]
> - The different distributors can provide discrepant list of available versions / supported configurations. Please refer to the official documentation to see the list of supported versions.
> - AdoptOpenJDK got moved to Eclipse Temurin and won't be updated anymore. It is highly recommended to migrate workflows from `adopt` and `adopt-openj9`, to `temurin` and `semeru` respectively, to keep receiving software and security updates. See more details in the [Good-bye AdoptOpenJDK post](https://blog.adoptopenjdk.net/2021/08/goodbye-adoptopenjdk-hello-adoptium/).
> - For Azul Zulu OpenJDK, architecture `arm64` is mapped to `aarch64` when querying the Azul Metadata API.
> - To comply with the GraalVM Free Terms and Conditions (GFTC) license, it is recommended to use GraalVM JDK 17 version 17.0.12, as this is the only version of GraalVM JDK 17 available under the GFTC license. Additionally, it is encouraged to consider upgrading to GraalVM JDK 21, which offers the latest features and improvements.
> - GraalVM Community is available as `distribution: 'graalvm-community'` for stable JDK 17 and later releases published on GitHub.

**NOTE:** Oracle JDK 17 licensing varies by patch level. As shown on the [JDK 17 Archive](https://www.oracle.com/java/technologies/javase/jdk17-archive-downloads.html) (versions up to 17.0.12 are under the [NFTC](https://www.oracle.com/downloads/licenses/no-fee-license.html) license) and the [JDK 17.0.13+ Archive](https://www.oracle.com/java/technologies/javase/jdk17-0-13-later-archive-downloads.html) (versions 17.0.13 and later are under the [OTN](https://www.oracle.com/downloads/licenses/javase-license1.html) license). To stay on the free NFTC license, use `distribution: 'oracle'` with `java-version: '17.0.12'` (or earlier) instead of the floating `'17'`. Alternatively, upgrade to Oracle JDK 21+, which remains under the NFTC license.

**NOTE:** On Ubuntu runners, commands executed via `sudo` do not inherit the `JAVA_HOME` and `PATH` set by `setup-java` and will fall back to the runner image's system-default JDK.

### Caching packages dependencies
The action has a built-in functionality for caching and restoring dependencies. It uses [toolkit/cache](https://github.com/actions/toolkit/tree/main/packages/cache) under hood for caching dependencies but requires less configuration settings. Supported package managers are gradle, maven and sbt. The format of the used cache key is `setup-java-${{ platform }}-${{ packageManager }}-${{ fileHash }}`, where the hash is based on the following files:

- gradle: `**/*.gradle*`, `**/gradle-wrapper.properties`, `buildSrc/**/Versions.kt`, `buildSrc/**/Dependencies.kt`, `gradle/*.versions.toml`, and `**/versions.properties`
- maven: `**/pom.xml`, `**/.mvn/wrapper/maven-wrapper.properties`, and `**/.mvn/extensions.xml`
- sbt: all sbt build definition files `**/*.sbt`, `**/project/build.properties`, `**/project/**.scala`, `**/project/**.sbt`

When the option `cache-dependency-path` is specified, the hash is based on the matching file. This option supports wildcards and a list of file names, and is especially useful for monorepos.

The workflow output `cache-hit` is set to indicate if an exact match was found for the key [as actions/cache does](https://github.com/actions/cache/tree/main#outputs).

The workflow output `cache-primary-key` exposes the primary cache key computed by the action for the configured build tool. It is useful for composing with [`actions/cache`](https://github.com/actions/cache) or [`actions/cache/restore`](https://github.com/actions/cache/tree/main/restore) in later steps or dependent jobs that need to reuse the exact same key. It is empty when caching is not enabled or when caching is skipped (for example, when the cache service is unavailable).

The cache input is optional, and caching is turned off by default.

**Maven Wrapper:** when `cache: 'maven'` is enabled, the action also caches and restores the Maven Wrapper distribution downloaded to `~/.m2/wrapper/dists` (in addition to the local repository), so wrapper-based (`./mvnw`) builds don't re-download the Maven distribution. The wrapper distribution is stored in a **separate** cache entry keyed only on `**/.mvn/wrapper/maven-wrapper.properties`, so it stays cached across the frequent `pom.xml` changes that rotate the main dependency cache key.

#### Caching gradle dependencies
```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '25'
      cache: 'gradle'
      cache-dependency-path: | # optional
        sub-project/*.gradle*
        sub-project/**/gradle-wrapper.properties
  - run: ./gradlew build --no-daemon
```
Using the `cache: gradle` provides a simple and effective way to cache Gradle dependencies with minimal configuration.

**Gradle Wrapper:** when `cache: 'gradle'` is enabled, the action also caches and restores the Gradle Wrapper distribution downloaded to `~/.gradle/wrapper` (in addition to the Gradle caches), so wrapper-based (`./gradlew`) builds don't re-download the Gradle distribution. The wrapper distribution is stored in a **separate** cache entry keyed only on `**/gradle-wrapper.properties`, so it stays cached across the frequent `*.gradle*` changes that rotate the main dependency cache key.

For projects that require more advanced `Gradle` caching features, such as caching build outputs, support for Gradle configuration cache, encrypted cache storage, fine-grained cache control (including options to enable or disable the cache, set it to read-only or write-only, perform automated cleanup, and define custom cache rules), or optimized performance for complex CI workflows, consider using [`gradle/actions/setup-gradle`](https://github.com/gradle/actions/tree/main/setup-gradle).  

For setup details and a comprehensive overview of all available features, visit the [setup-gradle documentation](https://github.com/gradle/actions/blob/main/docs/setup-gradle.md).

#### Caching maven dependencies
```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '25'
      cache: 'maven'
      cache-dependency-path: 'sub-project/pom.xml' # optional
  - name: Build with Maven
    run: mvn package --file pom.xml
```

> [!NOTE]
> Maven resolves plugin dependencies lazily, so a cache created by a "thin" goal
> (e.g. `mvn compile`) can be missing plugin dependencies that later
> `test`/`verify`/`package` jobs then re-download on every run. See
> [Ensuring the Maven cache is complete](docs/advanced-usage.md#ensuring-the-maven-cache-is-complete-plugin-dependencies)
> for how to seed a complete cache.

#### Caching sbt dependencies
```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '25'
      cache: 'sbt'
      cache-dependency-path: | # optional
        sub-project/build.sbt
        sub-project/project/build.properties
  - name: Build with SBT
    run: sbt package
```

#### Cache segment restore timeout
Usually, cache gets downloaded in multiple segments of fixed sizes. Sometimes, a segment download gets stuck, which causes the workflow job to be stuck. The cache segment download timeout [was introduced](https://github.com/actions/toolkit/tree/main/packages/cache#cache-segment-restore-timeout) to solve this issue as it allows the segment download to get aborted and hence allows the job to proceed with a cache miss. The default value of the cache segment download timeout is set to 10 minutes and can be customized by specifying an environment variable named `SEGMENT_DOWNLOAD_TIMEOUT_MINS` with a timeout value in minutes.

```yaml
env:
  SEGMENT_DOWNLOAD_TIMEOUT_MINS: '5'
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '25'
      cache: 'gradle'
  - run: ./gradlew build --no-daemon
```

### Check latest

In the basic examples above, the `check-latest` flag defaults to `false`. When set to `false`, the action tries to first resolve a version of Java from the local tool cache on the runner. If unable to find a specific version in the cache, the action will download a version of Java. Use the default or set `check-latest` to `false` if you prefer a faster more consistent setup experience that prioritizes trying to use the cached versions at the expense of newer versions sometimes being available for download.

If `check-latest` is set to `true`, the action first checks if the cached version is the latest one. If the locally cached version is not the most up-to-date, the latest version of Java will be downloaded. Set `check-latest` to `true` if you want the most up-to-date version of Java to always be used. Setting `check-latest` to `true` has performance implications as downloading versions of Java is slower than using cached versions.

For Java distributions that are not cached on Hosted images, `check-latest` always behaves as `true` and downloads Java on the fly. Check out [Hosted Tool Cache](docs/advanced-usage.md#Hosted-Tool-Cache) for more details about pre-cached Java versions.


```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '25'
      check-latest: true
  - run: java --version
```

### Testing against different Java versions
```yaml
jobs:
  build:
    runs-on: ubuntu-20.04
    strategy:
      matrix:
        java: [ '8', '11', '17', '21', '25' ]
    name: Java ${{ matrix.Java }} sample
    steps:
      - uses: actions/checkout@v7
      - name: Setup java
        uses: actions/setup-java@v6
        with:
          distribution: '<distribution>'
          java-version: ${{ matrix.java }}
      - run: java --version
```

### Install multiple JDKs

All configured Java versions are added to the PATH. The last one added to the PATH (i.e., the last JDK set up by this action) will be used as the default and available globally. Other Java versions can be accessed through environment variables such as 'JAVA\_HOME\_{{ MAJOR\_VERSION }}\_{{ ARCHITECTURE }}'. To use a specific Java version, set the JAVA\_HOME environment variable accordingly and prepend its bin directory to the PATH to ensure it takes priority during execution.

```yaml
   steps:
      - uses: actions/setup-java@v6
        with:
          distribution: '<distribution>'
          java-version: |
            8
            11
            15
```

### Using Maven Toolchains
In the example above multiple JDKs are installed for the same job. The result after the last JDK is installed is a Maven Toolchains declaration containing references to all three JDKs. The values for `id`, `version`, and `vendor` of the individual Toolchain entries are the given input values for `distribution` and `java-version` (`vendor` being the combination of `${distribution}_${java-version}`) by default.

### Advanced Configuration

- [Selecting a Java distribution](docs/advanced-usage.md#Selecting-a-Java-distribution)
    - [Eclipse Temurin](docs/advanced-usage.md#Eclipse-Temurin)
    - [Adopt](docs/advanced-usage.md#Adopt)
    - [Zulu](docs/advanced-usage.md#Zulu)
    - [Liberica](docs/advanced-usage.md#Liberica)
    - [Liberica Native Image Kit](docs/advanced-usage.md#Liberica-Native-Image-Kit)
    - [Microsoft](docs/advanced-usage.md#Microsoft)
    - [Amazon Corretto](docs/advanced-usage.md#Amazon-Corretto)
    - [Oracle](docs/advanced-usage.md#Oracle)
    - [Alibaba Dragonwell](docs/advanced-usage.md#Alibaba-Dragonwell)
    - [SapMachine](docs/advanced-usage.md#SapMachine)
    - [GraalVM](docs/advanced-usage.md#GraalVM)
    - [JetBrains](docs/advanced-usage.md#JetBrains)
    - [Tencent Kona](docs/advanced-usage.md#Tencent-Kona)
- [Installing custom Java package type](docs/advanced-usage.md#Installing-custom-Java-package-type)
- [Installing custom Java architecture](docs/advanced-usage.md#Installing-custom-Java-architecture)
- [Installing custom Java distribution from local file](docs/advanced-usage.md#Installing-Java-from-local-file)
- [Testing against different Java distributions](docs/advanced-usage.md#Testing-against-different-Java-distributions)
- [Testing against different platforms](docs/advanced-usage.md#Testing-against-different-platforms)
- [Publishing using Apache Maven](docs/advanced-usage.md#Publishing-using-Apache-Maven)
- [Maven transfer progress (download logs)](docs/advanced-usage.md#maven-transfer-progress-download-logs)
- [Publishing using Gradle](docs/advanced-usage.md#Publishing-using-Gradle)
- [Hosted Tool Cache](docs/advanced-usage.md#Hosted-Tool-Cache)
- [Modifying Maven Toolchains](docs/advanced-usage.md#Modifying-Maven-Toolchains)
- [Java Version File](docs/advanced-usage.md#Java-version-file)

## Recommended permissions

When using the `setup-java` action in your GitHub Actions workflow, it is recommended to set the following permissions to ensure proper functionality:

```yaml
permissions:
  contents: read # access to check out code and install dependencies
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

## Contributions

Contributions are welcome! See [Contributor's Guide](docs/contributors.md)
