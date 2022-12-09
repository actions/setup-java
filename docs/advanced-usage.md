# Usage
- [Selecting a Java distribution](#Selecting-a-Java-distribution)
  - [Eclipse Temurin](#Eclipse-Temurin)
  - [Adopt](#Adopt)
  - [Zulu](#Zulu)
  - [Liberica](#Liberica)
  - [Microsoft](#Microsoft)
  - [Amazon Corretto](#Amazon-Corretto)
- [Installing custom Java package type](#Installing-custom-Java-package-type)
- [Installing custom Java architecture](#Installing-custom-Java-architecture)
- [Installing custom Java distribution from local file](#Installing-Java-from-local-file)
- [Testing against different Java distributions](#Testing-against-different-Java-distributions)
- [Testing against different platforms](#Testing-against-different-platforms)
- [Publishing using Apache Maven](#Publishing-using-Apache-Maven)
- [Publishing using Gradle](#Publishing-using-Gradle)
- [Hosted Tool Cache](#Hosted-Tool-Cache)
- [Modifying Maven Toolchains](#Modifying-Maven-Toolchains)
- [Java-version file](#Java-version-file)

See [action.yml](../action.yml) for more details on task inputs.

## Selecting a Java distribution
Inputs `java-version` and `distribution` are mandatory and needs to be provided. See [Supported distributions](../README.md#Supported-distributions) for a list of available options.

### Eclipse Temurin
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'temurin'
    java-version: '11'
- run: java -cp java HelloWorldApp
```

### Adopt
**NOTE:** Adopt OpenJDK got moved to Eclipse Temurin and won't be updated anymore. It is highly recommended to migrate workflows from `adopt` to `temurin` to keep receiving software and security updates. See more details in the [Good-bye AdoptOpenJDK post](https://blog.adoptopenjdk.net/2021/08/goodbye-adoptopenjdk-hello-adoptium/).

```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'adopt-hotspot'
    java-version: '11'
- run: java -cp java HelloWorldApp
```

### Zulu
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'zulu'
    java-version: '11'
    java-package: jdk # optional (jdk, jre, jdk+fx or jre+fx) - defaults to jdk
- run: java -cp java HelloWorldApp
```

### Liberica
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'liberica'
    java-version: '11'
    java-package: jdk # optional (jdk, jre, jdk+fx or jre+fx) - defaults to jdk
- run: java -cp java HelloWorldApp
```

### Microsoft
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'microsoft'
    java-version: '11'
- run: java -cp java HelloWorldApp
```

### Using Microsoft distribution on GHES

`setup-java` comes pre-installed on the appliance with GHES if Actions is enabled. When dynamically downloading the Microsoft Build of OpenJDK distribution, `setup-java` makes a request to `actions/setup-java` to get available versions on github.com (outside of the appliance). These calls to `actions/setup-java` are made via unauthenticated requests, which are limited to [60 requests per hour per IP](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting). If more requests are made within the time frame, then you will start to see rate-limit errors during downloading that looks like: `##[error]API rate limit exceeded for...`.

To get a higher rate limit, you can [generate a personal access token on github.com](https://github.com/settings/tokens/new) and pass it as the `token` input for the action:

```yaml
uses: actions/setup-java@v3
with:
  token: ${{ secrets.GH_DOTCOM_TOKEN }}
  distribution: 'microsoft'
  java-version: '11'
```

If the runner is not able to access github.com, any Java versions requested during a workflow run must come from the runner's tool cache. See "[Setting up the tool cache on self-hosted runners without internet access](https://docs.github.com/en/enterprise-server@3.2/admin/github-actions/managing-access-to-actions-from-githubcom/setting-up-the-tool-cache-on-self-hosted-runners-without-internet-access)" for more information.

### Amazon Corretto
**NOTE:** Amazon Corretto only supports the major version specification.

```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'corretto'
    java-version: '11'
- run: java -cp java HelloWorldApp
```

## Installing custom Java package type
```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: '<distribution>'
    java-version: '11'
    java-package: jdk # optional (jdk or jre) - defaults to jdk
- run: java -cp java HelloWorldApp
```


## Installing custom Java architecture

```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: '<distribution>'
    java-version: '11'
    architecture: x86 # optional - defaults to x64
- run: java -cp java HelloWorldApp
```

## Installing Java from local file
If your use-case requires a custom distribution or a version that is not provided by setup-java, you can download it manually and setup-java will take care of the installation and caching on the VM:

```yaml
steps:
- run: |
    download_url="https://github.com/AdoptOpenJDK/openjdk11-binaries/releases/download/jdk-11.0.10%2B9/OpenJDK11U-jdk_x64_linux_hotspot_11.0.10_9.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v3
  with:
    distribution: 'jdkfile'
    jdkFile: ${{ runner.temp }}/java_package.tar.gz
    java-version: '11.0.0'
    architecture: x64
    
- run: java -cp java HelloWorldApp
```

## Testing against different Java distributions
**NOTE:** The different distributors can provide discrepant list of available versions / supported configurations. Please refer to the official documentation to see the list of supported versions.
```yaml
jobs:
  build:
    runs-on: ubuntu-20.04
    strategy:
      matrix:
        distribution: [ 'zulu', 'temurin' ]
        java: [ '8', '11' ]
    name: Java ${{ matrix.Java }} (${{ matrix.distribution }}) sample
    steps:
      - uses: actions/checkout@v3
      - name: Setup java
        uses: actions/setup-java@v3
        with:
          distribution: ${{ matrix.distribution }}
          java-version: ${{ matrix.java }}
      - run: java -cp java HelloWorldApp
```

#### Testing against different platforms
```yaml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        java: [ '8', '11' ]
        os: [ 'ubuntu-latest', 'macos-latest', 'windows-latest' ]
    name: Java ${{ matrix.Java }} (${{ matrix.os }}) sample
    steps:
      - uses: actions/checkout@v3
      - name: Setup java
        uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: ${{ matrix.java }}
      - run: java -cp java HelloWorldApp
```

## Publishing using Apache Maven
### Yaml example:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    - name: Set up JDK 11
      uses: actions/setup-java@v3
      with:
        distribution: '<distribution>'
        java-version: '11'

    - name: Build with Maven
      run: mvn -B package --file pom.xml

    - name: Publish to GitHub Packages Apache Maven
      run: mvn deploy
      env:
        GITHUB_TOKEN: ${{ github.token }} # GITHUB_TOKEN is the default env for the password

    - name: Set up Apache Maven Central
      uses: actions/setup-java@v3
      with: # running setup-java again overwrites the settings.xml
        distribution: 'temurin'
        java-version: '11'
        server-id: maven # Value of the distributionManagement/repository/id field of the pom.xml
        server-username: MAVEN_USERNAME # env variable for username in deploy
        server-password: MAVEN_CENTRAL_TOKEN # env variable for token in deploy
        gpg-private-key: ${{ secrets.MAVEN_GPG_PRIVATE_KEY }} # Value of the GPG private key to import
        gpg-passphrase: MAVEN_GPG_PASSPHRASE # env variable for GPG private key passphrase

    - name: Publish to Apache Maven Central
      run: mvn deploy
      env:
        MAVEN_USERNAME: maven_username123
        MAVEN_CENTRAL_TOKEN: ${{ secrets.MAVEN_CENTRAL_TOKEN }}
        MAVEN_GPG_PASSPHRASE: ${{ secrets.MAVEN_GPG_PASSPHRASE }}
```

The two `settings.xml` files created from the above example look like the following.

`settings.xml` file created for the first deploy to GitHub Packages
```xml
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>github</id>
      <username>${env.GITHUB_ACTOR}</username>
      <password>${env.GITHUB_TOKEN}</password>
    </server>
    <server>
      <id>gpg.passphrase</id>
      <passphrase>${env.GPG_PASSPHRASE}</passphrase>
    </server>
  </servers>
</settings>
```

`settings.xml` file created for the second deploy to Apache Maven Central
```xml
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>maven</id>
      <username>${env.MAVEN_USERNAME}</username>
      <password>${env.MAVEN_CENTRAL_TOKEN}</password>
    </server>
    <server>
      <id>gpg.passphrase</id>
      <passphrase>${env.MAVEN_GPG_PASSPHRASE}</passphrase>
    </server>
  </servers>
</settings>
```

***NOTE***: The `settings.xml` file is created in the Actions `$HOME/.m2` directory. If you have an existing `settings.xml` file at that location, it will be overwritten. See [below](#apache-maven-with-a-settings-path) for using the `settings-path` to change your `settings.xml` file location.

If you don't want to overwrite the `settings.xml` file, you can set `overwrite-settings: false`

### Extra setup for pom.xml:

The Maven GPG Plugin configuration in the pom.xml file should contain the following structure to avoid possible issues like `Inappropriate ioctl for device` or `gpg: signing failed: No such file or directory`:

```xml
<configuration>
  <!-- Prevent gpg from using pinentry programs -->
  <gpgArguments>
    <arg>--pinentry-mode</arg>
    <arg>loopback</arg>
  </gpgArguments>
</configuration>
```
GPG 2.1 requires `--pinentry-mode` to be set to `loopback` in order to pick up the `gpg.passphrase` value defined in Maven `settings.xml`.

### GPG

If `gpg-private-key` input is provided, the private key will be written to a file in the runner's temp directory, the private key file will be imported into the GPG keychain, and then the file will be promptly removed before proceeding with the rest of the setup process. A cleanup step will remove the imported private key from the GPG keychain after the job completes regardless of the job status. This ensures that the private key is no longer accessible on self-hosted runners and cannot "leak" between jobs (hosted runners are always clean instances).

**GPG key should be exported by: `gpg --armor --export-secret-keys YOUR_ID`**

See the help docs on [Publishing a Package](https://help.github.com/en/github/managing-packages-with-github-packages/configuring-apache-maven-for-use-with-github-packages#publishing-a-package) for more information on the `pom.xml` file.

## Apache Maven with a settings path

When using an Actions self-hosted runner with multiple shared runners the default `$HOME` directory can be shared by a number runners at the same time which could overwrite existing settings file. Setting the `settings-path` variable allows you to choose a unique location for your settings file.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    - name: Set up JDK 11 for Shared Runner
      uses: actions/setup-java@v3
      with:
        distribution: '<distribution>'
        java-version: '11'
        server-id: github # Value of the distributionManagement/repository/id field of the pom.xml
        settings-path: ${{ github.workspace }} # location for the settings.xml file

    - name: Build with Maven
      run: mvn -B package --file pom.xml

    - name: Publish to GitHub Packages Apache Maven
      run: mvn deploy -s $GITHUB_WORKSPACE/settings.xml
      env:
        GITHUB_TOKEN: ${{ github.token }}
```

## Publishing using Gradle
```yaml
jobs:

  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up JDK 11
      uses: actions/setup-java@v3
      with:
        distribution: '<distribution>'
        java-version: '11'

    - name: Build with Gradle
      run: gradle build

    - name: Publish to GitHub Packages
      run: gradle publish
      env:
        USERNAME: ${{ github.actor }}
        PASSWORD: ${{ secrets.GITHUB_TOKEN }}
```

***NOTE: The `USERNAME` and `PASSWORD` need to correspond to the credentials environment variables used in the publishing section of your `build.gradle`.***

See the help docs on [Publishing a Package with Gradle](https://help.github.com/en/github/managing-packages-with-github-packages/configuring-gradle-for-use-with-github-packages#example-using-gradle-groovy-for-a-single-package-in-a-repository) for more information on the `build.gradle` configuration file.

## Hosted Tool Cache
GitHub Hosted Runners have a tool cache that comes with some Java versions pre-installed. This tool cache helps speed up runs and tool setup by not requiring any new downloads. There is an environment variable called `RUNNER_TOOL_CACHE` on each runner that describes the location of this tools cache and this is where you can find the pre-installed versions of Java. `setup-java` works by taking a specific version of Java in this tool cache and adding it to PATH if the version, architecture and distribution match.

Currently, LTS versions of Eclipse Temurin (`temurin`) are cached on the GitHub Hosted Runners.

The tools cache gets updated on a weekly basis. For information regarding locally cached versions of Java on GitHub hosted runners, check out [GitHub Actions Virtual Environments](https://github.com/actions/virtual-environments).

## Modifying Maven Toolchains
The `setup-java` action generates a basic [Maven Toolchains declaration](https://maven.apache.org/guides/mini/guide-using-toolchains.html) for specified Java versions by either creating a minimal toolchains file or extending an existing declaration with the additional JDKs.

### Installing Multiple JDKs With Toolchains
Subsequent calls to `setup-java` with distinct distribution and version parameters will continue to extend the toolchains declaration and make all specified Java versions available.

```yaml
steps:
- uses: actions/setup-java@v3
  with:
    distribution: '<distribution>'
    java-version: |
      8
      11

- uses: actions/setup-java@v3
  with:
    distribution: '<distribution>'
    java-version: 15
```

The result is a Toolchain with entries for JDKs 8, 11 and 15. You can even combine this with custom JDKs of arbitrary versions:

```yaml
- run: |
    download_url="https://example.com/java/jdk/6u45-b06/jdk-6u45-linux-x64.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v3
  with:
    distribution: 'jdkfile'
    jdkFile: ${{ runner.temp }}/java_package.tar.gz
    java-version: '1.6'
    architecture: x64
```

This will generate a Toolchains entry with the following values: `version: 1.6`, `vendor: jkdfile`, `id: Oracle_1.6`.

### Modifying The Toolchain Vendor For JDKs
Each JDK provider will receive a default `vendor` using the `distribution` input value but this can be overridden with the `mvn-toolchain-vendor` parameter as follows.

```yaml
- run: |
    download_url="https://example.com/java/jdk/6u45-b06/jdk-6u45-linux-x64.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v3
  with:
    distribution: 'jdkfile'
    jdkFile: ${{ runner.temp }}/java_package.tar.gz
    java-version: '1.6'
    architecture: x64
    mvn-toolchain-vendor: 'Oracle'
```

This will generate a Toolchains entry with the following values: `version: 1.6`, `vendor: Oracle`, `id: Oracle_1.6`.

In case you install multiple versions of Java at once with multi-line `java-version` input setting the `mvn-toolchain-vendor` still only accepts one value and will use this value for installed JDKs as expected when installing multiple versions of the same `distribution`.

```yaml
steps:
- uses: actions/setup-java@v3
  with:
    distribution: '<distribution>'
    java-version: |
      8
      11
    mvn-toolchain-vendor: Eclipse Temurin
```

### Modifying The Toolchain ID For JDKs
Each JDK provider will receive a default `id` based on the combination of `distribution` and `java-version` in the format of `distribution_java-version` (e.g. `temurin_11`) but this can be overridden with the `mvn-toolchain-id` parameter as follows.

```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-java@v3
  with:
    distribution: 'temurin'
    java-version: '11'
    mvn-toolchain-id: 'some_other_id'
- run: java -cp java HelloWorldApp
```

In case you install multiple versions of Java at once you can use the same syntax as used in `java-versions`. Please note that you have to declare an ID for all Java versions that will be installed or the `mvn-toolchain-id` instruction will be skipped wholesale due to mapping ambiguities.

```yaml
steps:
- uses: actions/setup-java@v3
  with:
    distribution: '<distribution>'
    java-version: |
      8
      11
    mvn-toolchain-id: |
      something_else
      something_other
```

## Java-version file
If the `java-version-file` input is specified, the action will try to extract the version from the file and install it.
Action is able to recognize all variants of the version description according to [jenv](https://github.com/jenv/jenv). 
Valid entry options:
```
major versions: 8, 11, 16, 17
more specific versions: 1.8.0.2, 17.0, 11.0, 11.0.4, 8.0.232, 8.0.282+8
early access (EA) versions: 15-ea, 15.0.0-ea, 15.0.0-ea.2, 15.0.0+2-ea
versions with specified distribution: openjdk64-11.0.2
```
If the file contains multiple versions, only the first one will be recognized.
