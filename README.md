# setup-java

<p align="left">
  <a href="https://github.com/actions/setup-java"><img alt="GitHub Actions status" src="https://github.com/actions/setup-java/workflows/Main%20workflow/badge.svg"></a>
</p>

This action provides the following functionality for GitHub Actions runners:
- Downloading and setting up a requested version of Java. See [Usage](#Usage) section for the list of supported distributions
- Extracting and caching custom version of Java from local file
- Configuring runner for publishing using Apache Maven
- Configuring runner for publishing using Gradle
- Configuring runner for using GPG private key
- Registering problem matchers for error output

## V2 vs V1
- V2 has support of custom distributions and provides support of Zulu OpenJDK and Adoptium (former AdoptOpenJDK) out of the box. V1 supports only Zulu OpenJDK
- V2 requires you to specify distribution along with the version. V1 defaults to Zulu OpenJDK, only version input is required. Follow [the migration guide](docs/switching-to-v2.md) to switch from V1 to V2

## Usage
Input `distribution` is mandatory. See [Supported distributions](../README.md#Supported-distributions) section for the list of available options.

### Basic
```yaml
steps:
- uses: actions/checkout@v2
- uses: actions/setup-java@v2-preview
  with:
    distribution: 'adoptium' # See 'Supported distributions' for available options
    java-version: '11'
- run: java -cp java HelloWorldApp
```

#### Supported version syntax
Input `java-version` supports version range or exact version in [SemVer](https://semver.org/) format:
- major versions: `8`, `11`, `15`, `11.x`
- more specific versions: `8.0.232`, `11.0.4`, `11.0`, `11.0.x`
- an early access (EA) versions: `15-ea`, `15.0.0-ea`, `15.0.0-ea.2`

#### Supported distributions
Currently, the following distributions are supported:
| Keyword | Distribution | Official site | License |
|-|-|-|-|
| `zulu` | Zulu (Zulu OpenJDK) | [Link](https://www.azul.com/downloads/zulu-community/?package=jdk) | [Link](https://www.azul.com/products/zulu-and-zulu-enterprise/zulu-terms-of-use/) |
| `adoptium` | Adoptium (former Adopt OpenJDK) | [Link](https://adoptopenjdk.net/) | [Link](https://adoptopenjdk.net/about.html)

**NOTE:** The different distributors can provide discrepant list of available versions / supported configurations. Please refer to the official documentation to see the list of supported versions.

#### Testing against different Java versions
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
        uses: actions/setup-java@v2-preview
        with:
          distribution: '<distribution>'
          java-version: ${{ matrix.java }}
      - run: java -cp java HelloWorldApp
```

### Advanced
- [Selecting Java distribution](docs/advanced-usage.md#Selecting-Java-distribution)
  - [Adoptium](docs/advanced-usage.md#Adoptium)
  - [Zulu](docs/advanced-usage.md#Zulu)
- [Installing custom Java package type](docs/advanced-usage.md#Installing-custom-Java-package-type)
- [Installing custom Java architecture](docs/advanced-usage.md#Installing-custom-Java-architecture)
- [Installing custom Java distribution from local file](docs/advanced-usage.md#Installing-Java-from-local-file)
- [Testing against different Java distributions](docs/advanced-usage.md#Testing-against-different-Java-distributions)
- [Testing against different platforms](docs/advanced-usage.md#Testing-against-different-platforms)
- [Publishing using Apache Maven](docs/advanced-usage.md#Publishing-using-Apache-Maven)
- [Publishing using Gradle](docs/advanced-usage.md#Publishing-using-Gradle)


## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

## Contributions

Contributions are welcome!  See [Contributor's Guide](docs/contributors.md)
