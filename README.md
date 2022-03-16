# setup-java

<p align="left">
  <a href="https://github.com/actions/setup-java"><img alt="GitHub Actions status" src="https://github.com/actions/setup-java/workflows/Main%20workflow/badge.svg"></a>
</p>

This action provides the following functionality for GitHub Actions runners:
- Downloading and setting up a requested version of Java. See [Usage](#Usage) for a list of supported distributions
- Extracting and caching custom version of Java from a local file
- Configuring runner for publishing using Apache Maven
- Configuring runner for publishing using Gradle
- Configuring runner for using GPG private key
- Registering problem matchers for error output
- Caching dependencies managed by Apache Maven
- Caching dependencies managed by Gradle

## V2 vs V1
- V2 supports custom distributions and provides support for Zulu OpenJDK, Eclipse Temurin and Adopt OpenJDK  out of the box. V1 supports only Zulu OpenJDK
- V2 requires you to specify distribution along with the version. V1 defaults to Zulu OpenJDK, only version input is required. Follow [the migration guide](docs/switching-to-v2.md) to switch from V1 to V2

## Usage
Inputs `java-version` and `distribution` are mandatory. See [Supported distributions](#supported-distributions) section for a list of available options.

### Basic
**Eclipse Temurin**
```yaml
steps:
- uses: actions/checkout@v2
- uses: actions/setup-java@v2
  with:
    distribution: 'temurin' # See 'Supported distributions' for available options
    java-version: '17'
- run: java -cp java HelloWorldApp
```

**Zulu OpenJDK**
```yaml
steps:
- uses: actions/checkout@v2
- uses: actions/setup-java@v2
  with:
    distribution: 'zulu' # See 'Supported distributions' for available options
    java-version: '11'
- run: java -cp java HelloWorldApp
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
| `zulu` | Zulu OpenJDK | [Link](https://www.azul.com/downloads/zulu-community/?package=jdk) | [Link](https://www.azul.com/products/zulu-and-zulu-enterprise/zulu-terms-of-use/) |
| `adopt` or `adopt-hotspot` | Adopt OpenJDK Hotspot | [Link](https://adoptopenjdk.net/) | [Link](https://adoptopenjdk.net/about.html) |
| `adopt-openj9` | Adopt OpenJDK OpenJ9 | [Link](https://adoptopenjdk.net/) | [Link](https://adoptopenjdk.net/about.html) |
| `liberica` | Liberica JDK | [Link](https://bell-sw.com/) | [Link](https://bell-sw.com/liberica_eula/) |
| `microsoft` | Microsoft Build of OpenJDK | [Link](https://www.microsoft.com/openjdk) | [Link](https://docs.microsoft.com/java/openjdk/faq)

**NOTE:** The different distributors can provide discrepant list of available versions / supported configurations. Please refer to the official documentation to see the list of supported versions.

**NOTE:** Adopt OpenJDK got moved to Eclipse Temurin and won't be updated anymore. It is highly recommended to migrate workflows from `adopt` to `temurin` to keep receiving software and security updates. See more details in the [Good-bye AdoptOpenJDK post](https://blog.adoptopenjdk.net/2021/08/goodbye-adoptopenjdk-hello-adoptium/).

### Caching packages dependencies
The action has a built-in functionality for caching and restoring dependencies. It uses [actions/cache](https://github.com/actions/cache) under hood for caching dependencies but requires less configuration settings. Supported package managers are gradle and maven. The format of the used cache key is `setup-java-${{ platform }}-${{ packageManager }}-${{ fileHash }}`, where the hash is based on the following files:
- gradle: `**/*.gradle*`, `**/gradle-wrapper.properties`
- maven: `**/pom.xml`

The cache input is optional, and caching is turned off by default.

#### Caching gradle dependencies
```yaml
steps:
- uses: actions/checkout@v2
- uses: actions/setup-java@v2
  with:
    distribution: 'temurin'
    java-version: '11'
    cache: 'gradle'
- run: ./gradlew build --no-daemon
```

#### Caching maven dependencies
```yaml
steps:
- uses: actions/checkout@v2
- uses: actions/setup-java@v2
  with:
    distribution: 'temurin'
    java-version: '11'
    cache: 'maven'
- name: Build with Maven
  run: mvn -B package --file pom.xml
```

### Check latest
In the basic examples above, the `check-latest` flag defaults to `false`. When set to `false`, the action tries to first resolve a version of Java from the local tool cache on the runner. If unable to find a specific version in the cache, the action will download a version of Java. Use the default or set `check-latest` to `false` if you prefer a faster more consistent setup experience that prioritizes trying to use the cached versions at the expense of newer versions sometimes being available for download.

If `check-latest` is set to `true`, the action first checks if the cached version is the latest one. If the locally cached version is not the most up-to-date, the latest version of Java will be downloaded. Set `check-latest` to `true` if you want the most up-to-date version of Java to always be used. Setting `check-latest` to `true` has performance implications as downloading versions of Java is slower than using cached versions.

For Java distributions that are not cached on Hosted images, `check-latest` always behaves as `true` and downloads Java on-flight. Check out [Hosted Tool Cache](docs/advanced-usage.md#Hosted-Tool-Cache) for more details about pre-cached Java versions.  


```yaml
steps:
- uses: actions/checkout@v2
- uses: actions/setup-java@v2
  with:
    distribution: 'adopt'
    java-version: '11'
    check-latest: true
- run: java -cp java HelloWorldApp
```

### Testing against different Java versions
```yaml
jobs:
  build:
    runs-on: ubuntu-20.04
    strategy:
      matrix:
        java: [ '8', '11', '13', '15' ]
    name: Java ${{ matrix.Java }} sample
    steps:
      - uses: actions/checkout@v2
      - name: Setup java
        uses: actions/setup-java@v2
        with:
          distribution: '<distribution>'
          java-version: ${{ matrix.java }}
      - run: java -cp java HelloWorldApp
```

### Advanced
- [Selecting a Java distribution](docs/advanced-usage.md#Selecting-a-Java-distribution)
  - [Eclipse Temurin](docs/advanced-usage.md#Eclipse-Temurin)
  - [Adopt](docs/advanced-usage.md#Adopt)
  - [Zulu](docs/advanced-usage.md#Zulu)
  - [Liberica](docs/advanced-usage.md#Liberica)
- [Installing custom Java package type](docs/advanced-usage.md#Installing-custom-Java-package-type)
- [Installing custom Java architecture](docs/advanced-usage.md#Installing-custom-Java-architecture)
- [Installing custom Java distribution from local file](docs/advanced-usage.md#Installing-Java-from-local-file)
- [Using existing cacerts file](docs/advanced-usage.md#Using-existing-cacerts-file)
- [Testing against different Java distributions](docs/advanced-usage.md#Testing-against-different-Java-distributions)
- [Testing against different platforms](docs/advanced-usage.md#Testing-against-different-platforms)
- [Publishing using Apache Maven](docs/advanced-usage.md#Publishing-using-Apache-Maven)
- [Publishing using Gradle](docs/advanced-usage.md#Publishing-using-Gradle)
- [Hosted Tool Cache](docs/advanced-usage.md#Hosted-Tool-Cache)

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

## Contributions

Contributions are welcome! See [Contributor's Guide](CONTRIBUTING.md)
