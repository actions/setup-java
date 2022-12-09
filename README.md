# Setup Java

[![Main workflow](https://github.com/actions/setup-java/actions/workflows/workflow.yml/badge.svg)](https://github.com/actions/setup-java/actions/workflows/workflow.yml)

The `setup-java` action provides the following functionality for GitHub Actions runners:
- Downloading and setting up a requested version of Java. See [Usage](#Usage) for a list of supported distributions
- Extracting and caching custom version of Java from a local file
- Configuring runner for publishing using Apache Maven
- Configuring runner for publishing using Gradle
- Configuring runner for using GPG private key
- Registering problem matchers for error output
- Caching dependencies managed by Apache Maven
- Caching dependencies managed by Gradle
- Caching dependencies managed by sbt
- [Maven Toolchains declaration](https://maven.apache.org/guides/mini/guide-using-toolchains.html) for specified JDK versions

This action allows you to work with Java and Scala projects.

## V2 vs V1

- V2 supports custom distributions and provides support for Azul Zulu OpenJDK, Eclipse Temurin and AdoptOpenJDK  out of the box. V1 supports only Azul Zulu OpenJDK
- V2 requires you to specify distribution along with the version. V1 defaults to Azul Zulu OpenJDK, only version input is required. Follow [the migration guide](docs/switching-to-v2.md) to switch from V1 to V2

## Usage

  - `java-version`: The Java version to set up. Takes a whole or [semver](#supported-version-syntax) Java version. If not specified, the action will expect `java-version-file` input to be specified.

  - `java-version-file`: The path to the `.java-version` file. See more details in [about `.java-version` file](docs/advanced-usage.md#Java-version-file).
   
  - `distribution`: _(required)_ Java [distribution](#supported-distributions).

  - `java-package`: The packaging variant of the choosen distribution. Possible values: `jdk`, `jre`, `jdk+fx`, `jre+fx`. Default value: `jdk`.

  - `architecture`: The target architecture of the package. Possible values: `x86`, `x64`, `armv7`, `aarch64`, `ppc64le`. Default value: `x64`.

  - `jdkFile`: If a use-case requires a custom distribution setup-java uses the compressed JDK from the location pointed by this input and will take care of the installation and caching on the VM.

  - `check-latest`: Setting this option makes the action to check for the latest available version for the version spec.

  - `cache`: Quick [setup caching](#caching-packages-dependencies) for the dependencies managed through one of the predifined package managers. It can be one of "maven", "gradle" or "sbt". 

  #### Maven options
  The action has a bunch of inputs to generate maven's [settings.xml](https://maven.apache.org/settings.html) on the fly and pass the values to Apache Maven GPG Plugin as well as Apache Maven Toolchains. See [advanced usage](docs/advanced-usage.md) for more.

  - `overwrite-settings`: By default action overwrites the settings.xml. In order to skip generation of file if it exists set this to `false`.

  - `server-id`: ID of the distributionManagement repository in the pom.xml file. Default is `github`.

  - `server-username`: Environment variable name for the username for authentication to the Apache Maven repository. Default is GITHUB_ACTOR.

  - `server-password`: Environment variable name for password or token for authentication to the Apache Maven repository. Default is GITHUB_TOKEN.

  - `settings-path`: Maven related setting to point to the directory where the settings.xml file will be written. Default is ~/.m2.

  - `gpg-private-key`: GPG private key to import. Default is empty string.'

  - `gpg-passphrase`: description: 'Environment variable name for the GPG private key passphrase. Default is GPG_PASSPHRASE.

  - `mvn-toolchain-id`: Name of Maven Toolchain ID if the default name of `${distribution}_${java-version}` is not wanted.

  - `mvn-toolchain-vendor`: Name of Maven Toolchain Vendor if the default name of `${distribution}` is not wanted.

### Basic Configuration

#### Eclipse Temurin
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'temurin' # See 'Supported distributions' for available options
    java-version: '17'
- run: java HelloWorldApp.java
```

#### Azul Zulu OpenJDK
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'zulu' # See 'Supported distributions' for available options
    java-version: '17'
- run: java HelloWorldApp.java
```

#### Supported version syntax
The `java-version` input supports an exact version or a version range using [SemVer](https://semver.org/) notation:
- major versions: `8`, `11`, `16`, `17`
- more specific versions: `17.0`, `11.0`, `11.0.4`, `8.0.232`, `8.0.282+8`
- early access (EA) versions: `15-ea`, `15.0.0-ea`, `15.0.0-ea.2`, `15.0.0+2-ea`

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

**NOTE:** The different distributors can provide discrepant list of available versions / supported configurations. Please refer to the official documentation to see the list of supported versions.

**NOTE:** AdoptOpenJDK got moved to Eclipse Temurin and won't be updated anymore. It is highly recommended to migrate workflows from `adopt` to `temurin` to keep receiving software and security updates. See more details in the [Good-bye AdoptOpenJDK post](https://blog.adoptopenjdk.net/2021/08/goodbye-adoptopenjdk-hello-adoptium/).

**NOTE:** For Azul Zulu OpenJDK architectures x64 and arm64 are mapped to x86 / arm with proper hw_bitness.

### Caching packages dependencies
The action has a built-in functionality for caching and restoring dependencies. It uses [actions/cache](https://github.com/actions/cache) under hood for caching dependencies but requires less configuration settings. Supported package managers are gradle, maven and sbt. The format of the used cache key is `setup-java-${{ platform }}-${{ packageManager }}-${{ fileHash }}`, where the hash is based on the following files:
- gradle: `**/*.gradle*`, `**/gradle-wrapper.properties`, `buildSrc/**/Versions.kt`, `buildSrc/**/Dependencies.kt`, and `gradle/*.versions.toml`
- maven: `**/pom.xml`
- sbt: all sbt build definition files `**/*.sbt`, `**/project/build.properties`, `**/project/**.{scala,sbt}`

The workflow output `cache-hit` is set to indicate if an exact match was found for the key [as actions/cache does](https://github.com/actions/cache/tree/main#outputs).

The cache input is optional, and caching is turned off by default.

#### Caching gradle dependencies
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'temurin'
    java-version: '17'
    cache: 'gradle'
- run: ./gradlew build --no-daemon
```

#### Caching maven dependencies
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'temurin'
    java-version: '17'
    cache: 'maven'
- name: Build with Maven
  run: mvn -B package --file pom.xml
```

#### Caching sbt dependencies
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'temurin'
    java-version: '17'
    cache: 'sbt'
- name: Build with SBT
  run: sbt package
```

### Check latest

In the basic examples above, the `check-latest` flag defaults to `false`. When set to `false`, the action tries to first resolve a version of Java from the local tool cache on the runner. If unable to find a specific version in the cache, the action will download a version of Java. Use the default or set `check-latest` to `false` if you prefer a faster more consistent setup experience that prioritizes trying to use the cached versions at the expense of newer versions sometimes being available for download.

If `check-latest` is set to `true`, the action first checks if the cached version is the latest one. If the locally cached version is not the most up-to-date, the latest version of Java will be downloaded. Set `check-latest` to `true` if you want the most up-to-date version of Java to always be used. Setting `check-latest` to `true` has performance implications as downloading versions of Java is slower than using cached versions.

For Java distributions that are not cached on Hosted images, `check-latest` always behaves as `true` and downloads Java on-flight. Check out [Hosted Tool Cache](docs/advanced-usage.md#Hosted-Tool-Cache) for more details about pre-cached Java versions.  


```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'temurin'
    java-version: '17'
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
        java: [ '8', '11', '17' ]
    name: Java ${{ matrix.Java }} sample
    steps:
      - uses: actions/checkout@v3
      - name: Setup java
        uses: actions/setup-java@v3
        with:
          distribution: '<distribution>'
          java-version: ${{ matrix.java }}
      - run: java HelloWorldApp.java
```

### Install multiple JDKs

All versions are added to the PATH. The last version will be used and available globally. Other Java versions can be accessed through env variables with such specification as 'JAVA_HOME_{{ MAJOR_VERSION }}_{{ ARCHITECTURE }}'.

```yaml
    steps:
      - uses: actions/setup-java@v3
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
- [Installing custom Java package type](docs/advanced-usage.md#Installing-custom-Java-package-type)
- [Installing custom Java architecture](docs/advanced-usage.md#Installing-custom-Java-architecture)
- [Installing custom Java distribution from local file](docs/advanced-usage.md#Installing-Java-from-local-file)
- [Testing against different Java distributions](docs/advanced-usage.md#Testing-against-different-Java-distributions)
- [Testing against different platforms](docs/advanced-usage.md#Testing-against-different-platforms)
- [Publishing using Apache Maven](docs/advanced-usage.md#Publishing-using-Apache-Maven)
- [Publishing using Gradle](docs/advanced-usage.md#Publishing-using-Gradle)
- [Hosted Tool Cache](docs/advanced-usage.md#Hosted-Tool-Cache)
- [Modifying Maven Toolchains](docs/advanced-usage.md#Modifying-Maven-Toolchains)

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

## Contributions

Contributions are welcome! See [Contributor's Guide](docs/contributors.md)
