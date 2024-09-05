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

## V2 vs V1

- V2 supports custom distributions and provides support for Azul Zulu OpenJDK, Eclipse Temurin and AdoptOpenJDK  out of the box. V1 supports only Azul Zulu OpenJDK.
- V2 requires you to specify distribution along with the version. V1 defaults to Azul Zulu OpenJDK, only version input is required. Follow [the migration guide](docs/switching-to-v2.md) to switch from V1 to V2.

## Usage

  - `java-version`: The Java version that is going to be set up. Takes a whole or [semver](#supported-version-syntax) Java version. If not specified, the action will expect `java-version-file` input to be specified.

  - `java-version-file`: The path to a file containing java version. Supported file types are `.java-version` and `.tool-versions`. See more details in [about .java-version-file](docs/advanced-usage.md#Java-version-file).

  - `distribution`: _(required)_ Java [distribution](#supported-distributions).

  - `java-package`: The packaging variant of the chosen distribution. Possible values: `jdk`, `jre`, `jdk+fx`, `jre+fx`. Default value: `jdk`.

  - `architecture`: The target architecture of the package. Possible values: `x86`, `x64`, `armv7`, `aarch64`, `ppc64le`. Default value: Derived from the runner machine.

  - `jdkFile`: If a use-case requires a custom distribution setup-java uses the compressed JDK from the location pointed by this input and will take care of the installation and caching on the VM.

  - `check-latest`: Setting this option makes the action to check for the latest available version for the version spec.

  - `cache`: Quick [setup caching](#caching-packages-dependencies) for the dependencies managed through one of the predefined package managers. It can be one of "maven", "gradle" or "sbt".

  - `cache-dependency-path`: The path to a dependency file: pom.xml, build.gradle, build.sbt, etc. This option can be used with the `cache` option. If this option is omitted, the action searches for the dependency file in the entire repository. This option supports wildcards and a list of file names for caching multiple dependencies.

  #### Maven options
  The action has a bunch of inputs to generate maven's [settings.xml](https://maven.apache.org/settings.html) on the fly and pass the values to Apache Maven GPG Plugin as well as Apache Maven Toolchains. See [advanced usage](docs/advanced-usage.md) for more.

  - `overwrite-settings`: By default action overwrites the settings.xml. In order to skip generation of file if it exists, set this to `false`.

  - `server-id`: ID of the distributionManagement repository in the pom.xml file. Default is `github`.

  - `server-username`: Environment variable name for the username for authentication to the Apache Maven repository. Default is GITHUB_ACTOR.

  - `server-password`: Environment variable name for password or token for authentication to the Apache Maven repository. Default is GITHUB_TOKEN.

  - `settings-path`: Maven related setting to point to the directory where the settings.xml file will be written. Default is ~/.m2.

  - `gpg-private-key`: GPG private key to import. Default is empty string.

  - `gpg-passphrase`: Environment variable name for the GPG private key passphrase. Default is GPG_PASSPHRASE.

  - `mvn-toolchain-id`: Name of Maven Toolchain ID if the default name of `${distribution}_${java-version}` is not wanted.

  - `mvn-toolchain-vendor`: Name of Maven Toolchain Vendor if the default name of `${distribution}` is not wanted.

### Basic Configuration

#### Eclipse Temurin
```yaml
steps:
- uses: actions/checkout@v4
- uses: actions/setup-java@v4
  with:
    distribution: 'temurin' # See 'Supported distributions' for available options
    java-version: '21'
- run: java HelloWorldApp.java
```

#### Azul Zulu OpenJDK
```yaml
steps:
- uses: actions/checkout@v4
- uses: actions/setup-java@v4
  with:
    distribution: 'zulu' # See 'Supported distributions' for available options
    java-version: '21'
- run: java HelloWorldApp.java
```

#### Supported version syntax
The `java-version` input supports an exact version or a version range using [SemVer](https://semver.org/) notation:
- major versions: `8`, `11`, `16`, `17`, `21`
- more specific versions: `8.0.282+8`, `8.0.232`, `11.0`, `11.0.4`, `17.0`
- early access (EA) versions: `15-ea`, `15.0.0-ea`

#### Supported distributions
Currently, the following distributions are supported:
| Keyword | Distribution | Official site | License
|-|-|-|-|
| `temurin` | Eclipse Temurin | [Link](https://adoptium.net/) | [Link](https://adoptium.net/about.html)
| `zulu` | Azul Zulu OpenJDK | [Link](https://www.azul.com/downloads/zulu-community/?package=jdk) | [Link](https://www.azul.com/products/zulu-and-zulu-enterprise/zulu-terms-of-use/) |
| `adopt` or `adopt-hotspot` | AdoptOpenJDK Hotspot | [Link](https://adoptopenjdk.net/) | [Link](https://adoptopenjdk.net/about.html) |
| `adopt-openj9` | AdoptOpenJDK OpenJ9 | [Link](https://adoptopenjdk.net/) | [Link](https://adoptopenjdk.net/about.html) |
| `liberica` | Liberica JDK | [Link](https://bell-sw.com/) | [Link](https://bell-sw.com/liberica_eula/) |
| `microsoft` | Microsoft Build of OpenJDK | [Link](https://www.microsoft.com/openjdk) | [Link](https://docs.microsoft.com/java/openjdk/faq)
| `corretto` | Amazon Corretto Build of OpenJDK | [Link](https://aws.amazon.com/corretto/) | [Link](https://aws.amazon.com/corretto/faqs/)
| `semeru` | IBM Semeru Runtime Open Edition | [Link](https://developer.ibm.com/languages/java/semeru-runtimes/downloads/) | [Link](https://openjdk.java.net/legal/gplv2+ce.html) |
| `oracle` | Oracle JDK | [Link](https://www.oracle.com/java/technologies/downloads/) | [Link](https://java.com/freeuselicense)
| `dragonwell` | Alibaba Dragonwell JDK | [Link](https://dragonwell-jdk.io/) | [Link](https://www.aliyun.com/product/dragonwell/)
| `sapmachine` | SAP SapMachine JDK/JRE | [Link](https://sapmachine.io/) | [Link](https://github.com/SAP/SapMachine/blob/sapmachine/LICENSE)

**NOTE:** The different distributors can provide discrepant list of available versions / supported configurations. Please refer to the official documentation to see the list of supported versions.

**NOTE:** AdoptOpenJDK got moved to Eclipse Temurin and won't be updated anymore. It is highly recommended to migrate workflows from `adopt` and `adopt-openj9`, to `temurin` and `semeru` respectively, to keep receiving software and security updates. See more details in the [Good-bye AdoptOpenJDK post](https://blog.adoptopenjdk.net/2021/08/goodbye-adoptopenjdk-hello-adoptium/).

**NOTE:** For Azul Zulu OpenJDK architectures x64 and arm64 are mapped to x86 / arm with proper hw_bitness.

### Caching packages dependencies
The action has a built-in functionality for caching and restoring dependencies. It uses [toolkit/cache](https://github.com/actions/toolkit/tree/main/packages/cache) under hood for caching dependencies but requires less configuration settings. Supported package managers are gradle, maven and sbt. The format of the used cache key is `setup-java-${{ platform }}-${{ packageManager }}-${{ fileHash }}`, where the hash is based on the following files:

- gradle: `**/*.gradle*`, `**/gradle-wrapper.properties`, `buildSrc/**/Versions.kt`, `buildSrc/**/Dependencies.kt`, `gradle/*.versions.toml`, and `**/versions.properties`
- maven: `**/pom.xml`
- sbt: all sbt build definition files `**/*.sbt`, `**/project/build.properties`, `**/project/**.scala`, `**/project/**.sbt`

When the option `cache-dependency-path` is specified, the hash is based on the matching file. This option supports wildcards and a list of file names, and is especially useful for monorepos.

The workflow output `cache-hit` is set to indicate if an exact match was found for the key [as actions/cache does](https://github.com/actions/cache/tree/main#outputs).

The cache input is optional, and caching is turned off by default.

#### Caching gradle dependencies
```yaml
steps:
- uses: actions/checkout@v4
- uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '21'
    cache: 'gradle'
    cache-dependency-path: | # optional
      sub-project/*.gradle*
      sub-project/**/gradle-wrapper.properties
- run: ./gradlew build --no-daemon
```

#### Caching maven dependencies
```yaml
steps:
- uses: actions/checkout@v4
- uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '21'
    cache: 'maven'
    cache-dependency-path: 'sub-project/pom.xml' # optional
- name: Build with Maven
  run: mvn -B package --file pom.xml
```

#### Caching sbt dependencies
```yaml
steps:
- uses: actions/checkout@v4
- uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '21'
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
- uses: actions/checkout@v4
- uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '21'
    cache: 'gradle'
- run: ./gradlew build --no-daemon
```

### Check latest

In the basic examples above, the `check-latest` flag defaults to `false`. When set to `false`, the action tries to first resolve a version of Java from the local tool cache on the runner. If unable to find a specific version in the cache, the action will download a version of Java. Use the default or set `check-latest` to `false` if you prefer a faster more consistent setup experience that prioritizes trying to use the cached versions at the expense of newer versions sometimes being available for download.

If `check-latest` is set to `true`, the action first checks if the cached version is the latest one. If the locally cached version is not the most up-to-date, the latest version of Java will be downloaded. Set `check-latest` to `true` if you want the most up-to-date version of Java to always be used. Setting `check-latest` to `true` has performance implications as downloading versions of Java is slower than using cached versions.

For Java distributions that are not cached on Hosted images, `check-latest` always behaves as `true` and downloads Java on-flight. Check out [Hosted Tool Cache](docs/advanced-usage.md#Hosted-Tool-Cache) for more details about pre-cached Java versions.


```yaml
steps:
- uses: actions/checkout@v4
- uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '21'
    check-latest: true
- run: java HelloWorldApp.java
```

### Testing against different Java versions
```yaml
jobs:
  build:
    runs-on: ubuntu-20.04
    strategy:
      matrix:
        java: [ '8', '11', '17', '21' ]
    name: Java ${{ matrix.Java }} sample
    steps:
      - uses: actions/checkout@v4
      - name: Setup java
        uses: actions/setup-java@v4
        with:
          distribution: '<distribution>'
          java-version: ${{ matrix.java }}
      - run: java HelloWorldApp.java
```

### Install multiple JDKs

All versions are added to the PATH. The last version will be used and available globally. Other Java versions can be accessed through env variables with such specification as 'JAVA_HOME_{{ MAJOR_VERSION }}_{{ ARCHITECTURE }}'.

```yaml
    steps:
      - uses: actions/setup-java@v4
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
  - [Microsoft](docs/advanced-usage.md#Microsoft)
  - [Amazon Corretto](docs/advanced-usage.md#Amazon-Corretto)
  - [Oracle](docs/advanced-usage.md#Oracle)
  - [Alibaba Dragonwell](docs/advanced-usage.md#Alibaba-Dragonwell)
  - [SapMachine](docs/advanced-usage.md#SapMachine)
- [Installing custom Java package type](docs/advanced-usage.md#Installing-custom-Java-package-type)
- [Installing custom Java architecture](docs/advanced-usage.md#Installing-custom-Java-architecture)
- [Installing custom Java distribution from local file](docs/advanced-usage.md#Installing-Java-from-local-file)
- [Testing against different Java distributions](docs/advanced-usage.md#Testing-against-different-Java-distributions)
- [Testing against different platforms](docs/advanced-usage.md#Testing-against-different-platforms)
- [Publishing using Apache Maven](docs/advanced-usage.md#Publishing-using-Apache-Maven)
- [Publishing using Gradle](docs/advanced-usage.md#Publishing-using-Gradle)
- [Hosted Tool Cache](docs/advanced-usage.md#Hosted-Tool-Cache)
- [Modifying Maven Toolchains](docs/advanced-usage.md#Modifying-Maven-Toolchains)
- [Java Version File](docs/advanced-usage.md#Java-version-file)

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

## Contributions

Contributions are welcome! See [Contributor's Guide](docs/contributors.md)
