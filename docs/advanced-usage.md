# Usage
- [Selecting a Java distribution](#Selecting-a-Java-distribution)
  - [Eclipse Temurin](#Eclipse-Temurin)
  - [Adopt](#Adopt)
  - [Zulu](#Zulu)
  - [Liberica](#Liberica)
  - [Liberica Native Image Kit](#Liberica-Native-Image-Kit)
  - [Microsoft](#Microsoft)
  - [Amazon Corretto](#Amazon-Corretto)
  - [Oracle](#Oracle)
  - [Alibaba Dragonwell](#Alibaba-Dragonwell)
  - [SapMachine](#SapMachine)
  - [GraalVM](#GraalVM)
  - [GraalVM Community](#GraalVM-Community)
  - [JetBrains](#JetBrains)
  - [Tencent Kona](#Tencent-Kona)
- [Installing custom Java package type](#Installing-custom-Java-package-type)
  - [JavaFX Maven project](#JavaFX-Maven-project)
- [Ensuring the Maven cache is complete (plugin dependencies)](#ensuring-the-maven-cache-is-complete-plugin-dependencies)
- [Installing custom Java architecture](#Installing-custom-Java-architecture)
- [Installing JDK without setting as default](#Installing-JDK-without-setting-as-default)
- [Installing custom Java distribution from local file](#Installing-Java-from-local-file)
- [Testing against different Java distributions](#Testing-against-different-Java-distributions)
- [Testing against different platforms](#Testing-against-different-platforms)
- [Publishing using Apache Maven](#Publishing-using-Apache-Maven)
- [Maven transfer progress (download logs)](#Maven-transfer-progress-download-logs)
- [Publishing using Gradle](#Publishing-using-Gradle)
- [Hosted Tool Cache](#Hosted-Tool-Cache)
- [Modifying Maven Toolchains](#Modifying-Maven-Toolchains)
- [Java-version file](#Java-version-file)
- [Self-signed certificates and internal CAs (GitHub Enterprise)](#Self-signed-certificates-and-internal-CAs-GitHub-Enterprise)

See [action.yml](../action.yml) for more details on task inputs.

## Selecting a Java distribution
Inputs `java-version` and `distribution` are mandatory and needs to be provided. See [Supported distributions](../README.md#Supported-distributions) for a list of available options.

### Eclipse Temurin

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'temurin'
    java-version: '25'
- run: java --version
```

### Adopt
**NOTE:** Adopt OpenJDK got moved to Eclipse Temurin and won't be updated anymore. It is highly recommended to migrate workflows from `adopt` to `temurin` to keep receiving software and security updates. See more details in the [Good-bye AdoptOpenJDK post](https://blog.adoptopenjdk.net/2021/08/goodbye-adoptopenjdk-hello-adoptium/).

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'adopt-hotspot'
    java-version: '11'
- run: java --version
```

### Zulu

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'zulu'
    java-version: '25'
    java-package: jdk # optional (jdk, jre, jdk+fx, jre+fx, jdk+crac, or jre+crac) - defaults to jdk
- run: java --version
```

### Liberica

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'liberica'
    java-version: '25'
    java-package: jdk # optional (jdk, jre, jdk+fx or jre+fx) - defaults to jdk
- run: java --version
```

### Liberica Native Image Kit
Liberica Native Image Kit (NIK) is a GraalVM-based distribution. `java-version` selects the underlying JDK version (e.g. `17`, `21`, `25`). Use `java-package: jdk+fx` to get the `full` bundle with JavaFX/Swing support; otherwise the `standard` bundle (with extra languages) is installed. Available on Linux, macOS and Windows for `x64` and `aarch64`.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'liberica-nik'
    java-version: '25'
    java-package: jdk # optional (jdk or jdk+fx) - defaults to jdk
- run: native-image --version
```

### Microsoft

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'microsoft'
    java-version: '25'
- run: java --version
```

### Using Microsoft distribution on GHES

`setup-java` comes pre-installed on the appliance with GHES if Actions is enabled. When dynamically downloading the Microsoft Build of OpenJDK distribution, `setup-java` makes a request to `actions/setup-java` to get available versions on github.com (outside of the appliance). These calls to `actions/setup-java` are made via unauthenticated requests, which are limited to [60 requests per hour per IP](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting). If more requests are made within the time frame, then you will start to see rate-limit errors during downloading that looks like: `##[error]API rate limit exceeded for...`.

To get a higher rate limit, you can [generate a personal access token on github.com](https://github.com/settings/tokens/new) and pass it as the `token` input for the action:

```yaml
uses: actions/setup-java@v5
with:
  token: ${{ secrets.GH_DOTCOM_TOKEN }}
  distribution: 'microsoft'
  java-version: '25'
```

If the runner is not able to access github.com, any Java versions requested during a workflow run must come from the runner's tool cache. See "[Setting up the tool cache on self-hosted runners without internet access](https://docs.github.com/en/enterprise-server@3.2/admin/github-actions/managing-access-to-actions-from-githubcom/setting-up-the-tool-cache-on-self-hosted-runners-without-internet-access)" for more information.

### Amazon Corretto
**NOTE:** Amazon Corretto only supports the major version specification.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'corretto'
    java-version: '25'
- run: java --version
```

### Oracle
**NOTE:** Oracle Java SE Development Kit is only available for version 17 and later.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'oracle'
    java-version: '25'
- run: java --version
```

### Alibaba Dragonwell
**NOTE:** Alibaba Dragonwell only provides jdk.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'dragonwell'
    java-version: '8'
- run: java --version
```

### SapMachine
**NOTE:** An OpenJDK release maintained and supported by SAP
```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'sapmachine'
    java-version: '25'
- run: java --version
```

### GraalVM
**NOTE:** Oracle GraalVM is only available for JDK 17 and later.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'graalvm'
    java-version: '25'
- run: |
    java --version
    native-image --version
```

### GraalVM Community
**NOTE:** GraalVM Community is available for stable JDK 17 and later releases.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'graalvm-community'
    java-version: '21'
- run: |
    java --version
    native-image --version
```

### JetBrains

**NOTE:** JetBrains is only available for LTS versions on 11 or later (11, 17, 21, etc.).

Not all minor LTS versions are guaranteed to be available, since JetBrains considers what to ship IntelliJ IDEA with, most commonly on JDK 11.
For example, `11.0.24` is not available but `11.0.16` is.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'jetbrains'
    java-version: '11'
- run: java --version
```

The JetBrains installer uses the GitHub API to fetch the latest version. If you believe your project is going to be running into rate limits, you can provide a
GitHub token to the action to increase the rate limit. Set the `GITHUB_TOKEN` environment variable to the value of your GitHub token in the workflow file.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'jetbrains'
    java-version: '17'
    java-package: 'jdk' # optional (jdk, jre, jdk+jcef, jre+jcef, jdk+ft, or jre+ft) - defaults to jdk
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
- run: java --version
```

You can specify your package type (as shown in the [releases page](https://github.com/JetBrains/JetBrainsRuntime/releases/)) in the `java-package` parameter. 
The available package types are:

- `jdk` - JBRSDK
- `jre` - JBR (Vanilla)
- `jdk+jcef` - JBRSDK with JCEF
- `jre+jcef` - JBR with JCEF
- `jdk+ft` - JBRSDK (FreeType)
- `jre+ft` - JBR (FreeType)

### Tencent Kona
**NOTE:** Tencent Kona supports major versions 8, 11, 17, 21 and 25, and provides jdk only.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'kona'
    java-version: '21'
- run: java --version
```

## Installing custom Java package type
```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: '<distribution>'
    java-version: '25'
    java-package: jdk # optional (jdk or jre) - defaults to jdk
- run: java --version
```

### JavaFX Maven project

For JavaFX projects that use Maven, use `jdk+fx` (or `jre+fx`) as the `java-package` value together with a distribution that supports it (e.g. `zulu` or `liberica`). Then include the [`javafx-maven-plugin`](https://openjfx.io/openjfx-docs/#maven) in your `pom.xml` as described in the [Getting Started with JavaFX](https://openjfx.io/openjfx-docs/#maven) guide.

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'zulu'
    java-version: '25'
    java-package: jdk+fx
    cache: maven
- name: Build with Maven
  run: mvn --no-transfer-progress compile
```

To run the JavaFX application in CI:

```yaml
- name: Run with Maven
  run: mvn --no-transfer-progress javafx:run
```

## Ensuring the Maven cache is complete (plugin dependencies)

When you enable `cache: maven`, the action caches your local Maven repository
(`~/.m2/repository`). The cache key is a hash of your Maven inputs — every
`**/pom.xml`, plus `**/.mvn/wrapper/maven-wrapper.properties` and
`**/.mvn/extensions.xml` — so changing any of those files (for example bumping
the wrapper version or editing core extensions) produces a new key and
invalidates the cache. At the end of the job the action saves whatever was
downloaded during that run. It does **not** re-save the cache when the key
already matches (a cache *hit*).

Downloaded Maven Wrapper distributions (`~/.m2/wrapper/dists`) are cached in a
**separate** cache entry keyed only on `**/.mvn/wrapper/maven-wrapper.properties`.
Because the wrapper distribution changes far less often than your `pom.xml`
files, this keeps it available across the frequent dependency changes that
rotate the main cache key, so wrapper-based (`./mvnw`) builds don't re-download
the Maven distribution on every dependency change. See
[issue #1095](https://github.com/actions/setup-java/issues/1095).

Maven resolves **plugin** dependencies lazily: it only downloads the plugins and
plugin dependencies required by the goals that actually execute. As a result, the
run that first creates the cache determines what is stored. If that run executed a
"thin" goal such as `mvn compile`, plugins bound to later phases are never
resolved. For example, `maven-shade-plugin` (bound to `package`) pulls in
`plexus-archiver`, `commons-compress`, `io.airlift:aircompressor` and
`org.tukaani:xz` — none of which a `compile` run downloads. Those artifacts are
therefore absent from the cache, and because the action does not re-save on a
hit, every later `test`/`verify`/`package` job re-downloads them on every run.

### Seed the cache with a resolution step

To populate `~/.m2` as comprehensively as possible on the run that creates the
cache, run a dependency-resolution "seed" command before your build. Choose a
command based on how thorough you need it to be:

| Seed command | Resolves plugin dependencies? | Notes |
|--------------|:-----------------------------:|-------|
| `mvn dependency:resolve` | No | Resolves project dependencies only — misses plugin dependencies (e.g. `aircompressor`). |
| `mvn dependency:resolve-plugins` | Yes | Resolves plugins **and their dependencies**. |
| `mvn dependency:go-offline` | Yes | Resolves project and plugin dependencies (a superset). |
| `mvn dependency:go-offline dependency:resolve-plugins` | Yes (most thorough) | Recommended default. Use `dependency:resolve dependency:resolve-plugins` if `go-offline` is flaky or insufficient for your project. |

Single job — seed, then build (the cache saved at the end of this run contains
the full set):

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'temurin'
    java-version: '25'
    cache: 'maven'
- name: Seed the Maven cache
  run: mvn dependency:go-offline dependency:resolve-plugins
- name: Build with Maven
  run: mvn verify --file pom.xml
```

Separate seed job — useful for a matrix where different legs run different goals
(`test`, `check`, `verify`, `-Pprofile1`, ...) but all share the same `~/.m2`
cache. Without a seed, whichever job finishes first creates the cache from its
own partial `.m2`, and parallel jobs race to save an equally partial cache; the
seed job instead creates one comprehensive cache that every other job reuses:

```yaml
jobs:
  seed-cache:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-java@v5
      with:
        distribution: 'temurin'
        java-version: '25'
        cache: 'maven'
    - name: Seed the Maven cache
      run: mvn dependency:go-offline dependency:resolve-plugins

  build:
    needs: seed-cache
    runs-on: ubuntu-latest
    strategy:
      matrix:
        goal: ['test', 'verify', 'test -Pprofile1']
    steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-java@v5
      with:
        distribution: 'temurin'
        java-version: '25'
        cache: 'maven'
    - name: Build
      run: mvn ${{ matrix.goal }} --file pom.xml
```

### Caveats

- **The seed only helps on the run that creates the cache.** Once a cache exists
  for the current `pom.xml` hash, later runs get a hit and any additional
  downloads are not saved. On an existing repository whose cache is already
  incomplete, invalidate it once (for example by changing `cache-dependency-path`
  or deleting the repository's caches) so a complete cache is created from the
  seed.
- **Static resolution is not exhaustive.** `go-offline`/`resolve-plugins` resolve
  the statically declared plugin set for the *active* profiles and modules.
  Profile-gated plugins, conditionally-active modules, and artifacts a plugin
  fetches at execution time may still be missed. For the most complete cache,
  seed with the fullest goal set your CI actually uses (for example
  `mvn verify` with every profile enabled).
- **Multi-module projects:** run the seed at the reactor root so every module's
  plugins are resolved.

> [!NOTE]
> The same "the cache stores only what the creating run downloaded, and is not
> re-saved on a hit" behavior applies to `cache: gradle`, since Gradle also
> resolves dependencies and plugin/buildscript classpaths lazily. Gradle has no
> direct equivalent of `dependency:go-offline`, so for complete and fine-grained
> dependency caching on Gradle projects we recommend
> [`gradle/actions/setup-gradle`](https://github.com/gradle/actions/tree/main/setup-gradle),
> which provides purpose-built caching (see the
> [setup-gradle documentation](https://github.com/gradle/actions/blob/main/docs/setup-gradle.md)).

## Installing custom Java architecture

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: '<distribution>'
    java-version: '25'
    architecture: x86 # optional - default value derived from the runner machine
- run: java --version
```

## Installing JDK without setting as default

When installing multiple JDKs, the last one installed becomes the default (`JAVA_HOME`, `PATH`). Use the `set-default` option to install a JDK without overriding the default. The installed JDK is still discoverable via the `JAVA_HOME_<major>_<arch>` environment variable (e.g. `JAVA_HOME_21_X64`).

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'temurin'
    java-version: '17'
- uses: actions/setup-java@v5
  id: setup-java-21
  with:
    distribution: 'temurin'
    java-version: '21'
    set-default: false
- run: |
    echo "Default java:"
    java -version
    echo "Java 21 home: $JAVA_HOME_21_X64"
    echo "Java 21 path from output: ${{ steps.setup-java-21.outputs.path }}"
```

In this example, `JAVA_HOME` and `java` on `PATH` point to Java 17, while Java 21 is available via `JAVA_HOME_21_X64` or the step output `path`.

> **Note:** When a single step installs multiple JDKs via a multiline `java-version`, the `set-default` value applies to all of them. With `set-default: false`, none of those JDKs become the default; each remains discoverable through its `JAVA_HOME_<major>_<arch>` variable. Regardless of `set-default`, installed JDKs are still registered in the Maven toolchains file, so they can be selected via Maven toolchains.

## Installing Java from local file
If your use-case requires a custom distribution or a version that is not provided by setup-java, you can download it manually and setup-java will take care of the installation and caching on the VM:

> [!NOTE]
> This approach also lets you use builds that setup-java does not provide directly, such as **Early Access (EA)** or other unreleased JDK builds (for example, an upcoming feature release or a Loom/Valhalla preview build). Download the desired archive in a prior step and point `jdk-file` at it; setup-java will extract, install, and cache it just like a supported distribution. When targeting multiple architectures, select the correct binary per architecture in your workflow (for example, with a build matrix).

```yaml
steps:
- run: |
    download_url="https://github.com/AdoptOpenJDK/openjdk11-binaries/releases/download/jdk-11.0.10%2B9/OpenJDK11U-jdk_x64_linux_hotspot_11.0.10_9.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v5
  with:
    distribution: 'jdkfile'
    jdk-file: ${{ runner.temp }}/java_package.tar.gz
    java-version: '11.0.0'
    architecture: x64
    
- run: java --version
```

For example, to use an **Early Access** build from [jdk.java.net](https://jdk.java.net/), download the archive for your runner OS/architecture and install it via `distribution: 'jdkfile'` (example below assumes Linux x64):

```yaml
steps:
- run: |
    download_url="https://download.java.net/java/early_access/jdk25/36/GPL/openjdk-25-ea+36_linux-x64_bin.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v5
  with:
    distribution: 'jdkfile'
    jdk-file: ${{ runner.temp }}/java_package.tar.gz
    java-version: '25.0.0-ea.36'
    architecture: x64

- run: java --version
```

If your use-case requires a custom distribution (in the example, alpine-linux is used) or a version that is not provided by setup-java and you want to always install the latest version during runtime, then you can use the following code to auto-download the latest JDK, determine the semver needed for setup-java, and setup-java will take care of the installation and caching on the VM:

```yaml
   steps:
      - name: fetch latest temurin JDK
        id: fetch_latest_jdk
        run: |
          major_version={{ env.JAVA_VERSION }} # Example 16 or 21 or 22
          cd $RUNNER_TEMP
          response=$(curl -s "https://api.github.com/repos/adoptium/temurin${major_version}-binaries/releases")
          latest_jdk_download_url=$(echo "$response" | jq -r '.[0].assets[] | select(.name | contains("jdk_x64_alpine-linux") and endswith(".tar.gz")) | .browser_download_url')
          curl -Ls "$latest_jdk_download_url" -o java_package.tar.gz
          latest_jdk_json_url=$(jdk_download_url "$response" | jq -r '.[0].assets[] | select(.name | contains("jdk_x64_alpine-linux") and endswith(".tar.gz.json")) | .browser_download_url')
          latest_semver_version=$(curl -sL $latest_jdk_json_url | jq -r 'version.semver')
          echo "java_version=$latest_semver_version" >> "$GITHUB_OUTPUT"

      - uses: actions/setup-java@v5
        with:
          distribution: 'jdkfile'
          jdk-file: ${{ runner.temp }}/java_package.tar.gz
          java-version: {{ steps.fetch_latest_jdk.outputs.java_version }}
          architecture: x64
       - run: java --version
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
      - uses: actions/checkout@v6
      - name: Setup java
        uses: actions/setup-java@v5
        with:
          distribution: ${{ matrix.distribution }}
          java-version: ${{ matrix.java }}
      - run: java --version
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
      - uses: actions/checkout@v6
      - name: Setup java
        uses: actions/setup-java@v5
        with:
          distribution: 'temurin'
          java-version: ${{ matrix.java }}
      - run: java --version
```

## Publishing using Apache Maven
### Yaml example:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v6
    - name: Set up JDK 11
      uses: actions/setup-java@v5
      with:
        distribution: '<distribution>'
        java-version: '11'

    - name: Build with Maven
      run: mvn package --file pom.xml

    - name: Publish to GitHub Packages Apache Maven
      run: mvn deploy
      env:
        GITHUB_TOKEN: ${{ github.token }} # GITHUB_TOKEN is the default env for the password

    - name: Set up Apache Maven Central
      uses: actions/setup-java@v5
      with: # running setup-java again overwrites the settings.xml
        distribution: 'temurin'
        java-version: '11'
        server-id: maven # Value of the distributionManagement/repository/id field of the pom.xml
        server-username-env-var: MAVEN_USERNAME # env variable for username in deploy
        server-password-env-var: MAVEN_CENTRAL_TOKEN # env variable for token in deploy

    - name: Publish to Apache Maven Central
      run: mvn deploy -Dgpg.signer=bc # requires maven-gpg-plugin >= 3.2.0 (bc signer support)
      env:
        MAVEN_USERNAME: maven_username123
        MAVEN_CENTRAL_TOKEN: ${{ secrets.MAVEN_CENTRAL_TOKEN }}
        MAVEN_GPG_KEY: ${{ secrets.MAVEN_GPG_PRIVATE_KEY }} # ASCII-armored secret key (TSK), e.g. from `gpg --armor --export-secret-keys YOUR_ID`
        MAVEN_GPG_PASSPHRASE: ${{ secrets.MAVEN_GPG_PASSPHRASE }}
```

The two `settings.xml` files created from the above example look like the following.

`settings.xml` file created for the first deploy to GitHub Packages
```xml
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <interactiveMode>false</interactiveMode>
  <servers>
    <server>
      <id>github</id>
      <username>${env.GITHUB_ACTOR}</username>
      <password>${env.GITHUB_TOKEN}</password>
    </server>
  </servers>
</settings>
```

`settings.xml` file created for the second deploy to Apache Maven Central
```xml
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <interactiveMode>false</interactiveMode>
  <servers>
    <server>
      <id>maven</id>
      <username>${env.MAVEN_USERNAME}</username>
      <password>${env.MAVEN_CENTRAL_TOKEN}</password>
    </server>
  </servers>
</settings>
```

***NOTE***: The `settings.xml` file is created in the Actions `$HOME/.m2` directory. If you have an existing `settings.xml` file at that location, it will be overwritten. See [below](#apache-maven-with-a-settings-path) for using the `settings-path` to change your `settings.xml` file location.

***NOTE***: The generated `settings.xml` sets `<interactiveMode>false</interactiveMode>` so that Maven never blocks a CI run waiting on an interactive prompt. This is applied automatically whenever the action generates `settings.xml`.

If you don't want to overwrite the `settings.xml` file, you can set `overwrite-settings: false`

### GPG

The example above uses the [Maven GPG Plugin](https://maven.apache.org/plugins/maven-gpg-plugin/)'s Bouncy Castle signer (`-Dgpg.signer=bc`, available since `maven-gpg-plugin` 3.2.0). It is a pure-Java signer that reads the key directly from the `MAVEN_GPG_KEY` environment variable, so it does **not** require the `gpg` executable, importing the key into a GPG keychain, or the `--pinentry-mode loopback` workaround in your `pom.xml`. The key must be an ASCII-armored secret key (transferable secret key format).

**GPG key should be exported by: `gpg --armor --export-secret-keys YOUR_ID`**

See the help docs on [Publishing a Package](https://help.github.com/en/github/managing-packages-with-github-packages/configuring-apache-maven-for-use-with-github-packages#publishing-a-package) for more information on the `pom.xml` file.

#### Legacy / alternative: let setup-java import the key

If you prefer signing with the `gpg` executable (for example because you are using `maven-gpg-plugin` older than 3.2.0), you can let setup-java import the key instead by providing the `gpg-private-key` and `gpg-passphrase-env-var` inputs. The private key is written to a file in the runner's temp directory, imported into the GPG keychain, and the file is promptly removed before proceeding with the rest of the setup process. A cleanup step removes the imported private key from the GPG keychain after the job completes regardless of the job status. This ensures that the private key is no longer accessible on self-hosted runners and cannot "leak" between jobs (hosted runners are always clean instances).

setup-java imports the key independently of the plugin version, but the generated passphrase profile described below uses `gpg.passphraseEnvName`, which requires `maven-gpg-plugin` 3.2.0 or newer. Since `gpg-passphrase-env-var` defaults to `GPG_PASSPHRASE`, setup-java writes that profile unless you override the input to `MAVEN_GPG_PASSPHRASE`.

```yaml
    - name: Set up Apache Maven Central
      uses: actions/setup-java@v5
      with:
        distribution: 'temurin'
        java-version: '11'
        server-id: maven # Value of the distributionManagement/repository/id field of the pom.xml
        server-username-env-var: MAVEN_USERNAME # env variable for username in deploy
        server-password-env-var: MAVEN_CENTRAL_TOKEN # env variable for token in deploy
        gpg-private-key: ${{ secrets.MAVEN_GPG_PRIVATE_KEY }} # Value of the GPG private key to import
        gpg-passphrase-env-var: MAVEN_GPG_PASSPHRASE # env variable for GPG private key passphrase

    - name: Publish to Apache Maven Central
      run: mvn deploy
      env:
        MAVEN_USERNAME: maven_username123
        MAVEN_CENTRAL_TOKEN: ${{ secrets.MAVEN_CENTRAL_TOKEN }}
        MAVEN_GPG_PASSPHRASE: ${{ secrets.MAVEN_GPG_PASSPHRASE }}
```

The `gpg-passphrase-env-var` input is the **name of the environment variable** that holds the passphrase (not the passphrase itself). It defaults to `GPG_PASSPHRASE`. The [Maven GPG Plugin](https://maven.apache.org/plugins/maven-gpg-plugin/) reads the passphrase from the environment variable named by its `gpg.passphraseEnvName` property, whose own default is `MAVEN_GPG_PASSPHRASE`.

- If `gpg-passphrase-env-var` is `MAVEN_GPG_PASSPHRASE`, the plugin already reads that variable by default, so setup-java writes nothing extra to `settings.xml`.
- Otherwise (including the default `GPG_PASSPHRASE`), setup-java configures `gpg.passphraseEnvName` through an active profile in the generated `settings.xml` so the plugin reads the passphrase from that variable. For the default `gpg-passphrase-env-var: GPG_PASSPHRASE`:

```xml
    <profiles>
      <profile>
        <id>setup-java-gpg</id>
        <properties>
          <gpg.passphraseEnvName>GPG_PASSPHRASE</gpg.passphraseEnvName>
        </properties>
      </profile>
    </profiles>
    <activeProfiles>
      <activeProfile>setup-java-gpg</activeProfile>
    </activeProfiles>
```

> **Note:** Earlier versions of setup-java wrote a `gpg.passphrase` server to `settings.xml`. That mechanism is deprecated by the Maven GPG Plugin and fails when its `bestPractices` mode is enabled, so setup-java now relies on `gpg.passphraseEnvName` instead. Set the environment variable name with `gpg-passphrase-env-var`, which defaults to `GPG_PASSPHRASE`.

> **Compatibility note:** Reading the passphrase from an environment variable (`gpg.passphraseEnvName`) requires `maven-gpg-plugin` 3.2.0 or newer. Older versions do not honor this property and will not pick up the passphrase, because setup-java no longer writes the deprecated `gpg.passphrase` server to `settings.xml`. If you are pinned to `maven-gpg-plugin` older than 3.2.0, upgrade to 3.2.0+.

When signing with the `gpg` executable, the Maven GPG Plugin configuration in your `pom.xml` should contain the following structure to avoid possible issues like `Inappropriate ioctl for device` or `gpg: signing failed: No such file or directory`:

```xml
<configuration>
  <!-- Prevent gpg from using pinentry programs -->
  <gpgArguments>
    <arg>--pinentry-mode</arg>
    <arg>loopback</arg>
  </gpgArguments>
</configuration>
```

GPG 2.1 requires `--pinentry-mode` to be set to `loopback` in order to read the passphrase non-interactively.

***NOTE***: If, when using the default `gpg` signer, the error `gpg: Sorry, no terminal at all requested - can't get input` [is encountered](https://github.com/actions/setup-java/issues/554), please update the version of `maven-gpg-plugin` to 1.6 or higher.

## Apache Maven with a settings path

When using an Actions self-hosted runner with multiple shared runners the default `$HOME` directory can be shared by a number runners at the same time which could overwrite existing settings file. Setting the `settings-path` variable allows you to choose a unique location for your settings file.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v6
    - name: Set up JDK 11 for Shared Runner
      uses: actions/setup-java@v5
      with:
        distribution: '<distribution>'
        java-version: '11'
        server-id: github # Value of the distributionManagement/repository/id field of the pom.xml
        settings-path: ${{ github.workspace }} # location for the settings.xml file

    - name: Build with Maven
      run: mvn package --file pom.xml

    - name: Publish to GitHub Packages Apache Maven
      run: mvn deploy -s $GITHUB_WORKSPACE/settings.xml
      env:
        GITHUB_TOKEN: ${{ github.token }}
```

## Maven transfer progress (download logs)

By default, Maven prints a line for every artifact it downloads, which can add hundreds of noisy lines to CI logs. To keep logs clean, `setup-java` sets the [`MAVEN_ARGS`](https://maven.apache.org/configure.html#maven_args-environment-variable) environment variable to include `-ntp` (`--no-transfer-progress`) so that subsequent Maven invocations in the job suppress this transfer progress output.

This is enabled by default. Any existing `MAVEN_ARGS` value is preserved (the flag is appended, not overwritten), and the flag is not added twice if you already set it yourself.

If you want to keep the download/transfer progress in your logs, set `show-download-progress: true`:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-java@v5
      with:
        distribution: '<distribution>'
        java-version: '21'
        show-download-progress: true # keep Maven download/transfer progress in the logs

    - name: Build with Maven
      run: mvn package --file pom.xml
```

***NOTES***:
- `MAVEN_ARGS` is honored by Maven 3.9.0+ and the Maven Wrapper (`mvnw`). Older Maven versions ignore it, so on those you can pass `--no-transfer-progress` on the command line instead.
- This setting only affects Maven. It has no effect on Gradle, sbt, or other build tools.
- `-ntp` only controls transfer/progress output. The `settings.xml` generated by `setup-java` separately sets `<interactiveMode>false</interactiveMode>`. If you use `overwrite-settings: false`, ensure your existing settings disable interactive mode or pass `-B`/`--batch-mode`.

## Java problem matcher (compiler annotations)

By default, `setup-java` registers a [problem matcher](https://github.com/actions/toolkit/blob/main/docs/problem-matchers.md) for Java after installing the JDK. It scans the log output of subsequent steps and turns Java diagnostics into GitHub [annotations](https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions#setting-a-warning-message) that appear in the run summary and inline on the affected files. It matches three kinds of lines:

- Compiler errors and warnings, e.g. `App.java:12: error: cannot find symbol` (owner `javac`).
- Maven compiler errors and warnings, e.g. `[ERROR] /path/App.java:[12,5] cannot find symbol` (owner `maven-javac`).
- Uncaught-exception header lines, e.g. `Exception in thread "main" ...`; because these lines have no file or line captures, they appear as log/run-level annotations rather than inline file annotations (owner `java`).

GitHub Actions limits problem matcher annotations to 10 of each severity per step and 50 annotations per job. Additional diagnostics remain available in the build log. Log grouping does not change these limits because every matched diagnostic still counts as an annotation.

### Disabling the problem matcher

Set `problem-matcher` to `false` to prevent the matcher from being registered:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-java@v5
      with:
        distribution: '<distribution>'
        java-version: '21'
        problem-matcher: false

    - name: Build with Maven
      run: mvn package --file pom.xml
```

Disabling the matcher only stops annotations from being created. Compiler output remains in the log, and compilation errors still fail the build step.

## Publishing using Gradle
```yaml
jobs:

  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v6

    - name: Set up JDK 11
      uses: actions/setup-java@v5
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

Toolchain entries are always merged non-destructively: existing JDK, custom, and user-managed toolchains are preserved, and only an entry with the exact same `type` and `provides.id` is replaced. This behavior is independent of the `overwrite-settings` input, which only controls regeneration of `settings.xml`. As a result, running `setup-java` several times in the same job (for example in multiple steps or with multiple `java-version` values) accumulates every JDK in `toolchains.xml` instead of dropping previously registered entries.

```yaml
steps:
- uses: actions/setup-java@v5
  with:
    distribution: '<distribution>'
    java-version: |
      8
      11

- uses: actions/setup-java@v5
  with:
    distribution: '<distribution>'
    java-version: '15'
```

The result is a Toolchain with entries for JDKs 8, 11 and 15. You can even combine this with custom JDKs of arbitrary versions:

```yaml
- run: |
    download_url="https://example.com/java/jdk/6u45-b06/jdk-6u45-linux-x64.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v5
  with:
    distribution: 'jdkfile'
    jdk-file: ${{ runner.temp }}/java_package.tar.gz
    java-version: '1.6'
    architecture: x64
```

This will generate a Toolchains entry with the following values: `version: 1.6`, `vendor: jdkfile`, `id: Oracle_1.6`.

### Modifying The Toolchain Vendor For JDKs
Each JDK provider will receive a default `vendor` using the `distribution` input value but this can be overridden with the `mvn-toolchain-vendor` parameter as follows.

```yaml
- run: |
    download_url="https://example.com/java/jdk/6u45-b06/jdk-6u45-linux-x64.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v5
  with:
    distribution: 'jdkfile'
    jdk-file: ${{ runner.temp }}/java_package.tar.gz
    java-version: '1.6'
    architecture: x64
    mvn-toolchain-vendor: 'Oracle'
```

This will generate a Toolchains entry with the following values: `version: 1.6`, `vendor: Oracle`, `id: Oracle_1.6`.

In case you install multiple versions of Java at once with multi-line `java-version` input setting the `mvn-toolchain-vendor` still only accepts one value and will use this value for installed JDKs as expected when installing multiple versions of the same `distribution`.

```yaml
steps:
- uses: actions/setup-java@v5
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
- uses: actions/checkout@v6
- uses: actions/setup-java@v5
  with:
    distribution: 'temurin'
    java-version: '11'
    mvn-toolchain-id: 'some_other_id'
- run: java --version
```

In case you install multiple versions of Java at once you can use the same syntax as used in `java-versions`. Please note that you have to declare an ID for all Java versions that will be installed or the `mvn-toolchain-id` instruction will be skipped wholesale due to mapping ambiguities.

```yaml
steps:
- uses: actions/setup-java@v5
  with:
    distribution: '<distribution>'
    java-version: |
      8
      11
    mvn-toolchain-id: |
      something_else
      something_other
```

## Java version file
  If the `java-version-file` input is specified, the action will extract the version from the file and install it.
  
  Supported files are `.java-version`, `.tool-versions` and `.sdkmanrc`.
  * In `.java-version` file, only the version should be specified (e.g., 17.0.7). The `.java-version` file recognizes all variants of the version description according to [jenv](https://github.com/jenv/jenv).
  * In `.tool-versions` file, java version should be preceded by the java keyword (e.g., java 17.0.7). The `.tool-versions` file supports version specifications in accordance with [asdf](https://github.com/asdf-vm/asdf) standards, adhering to Semantic Versioning ([semver](https://semver.org/)). When the entry includes an [asdf-java](https://github.com/halcyon/asdf-java) vendor prefix (e.g. `java temurin-17.0.3+7`), setup-java can infer the `distribution` input automatically. Unrecognized vendor prefixes require setting `distribution` explicitly.

    Supported asdf-java vendor prefix mappings (packaging variants such as `-jre`, `-musl`, `-openj9`, `-crac`, `-javafx` are collapsed onto the base vendor):

    | asdf-java vendor prefix | setup-java distribution |
    | ----------------------- | ----------------------- |
    | `temurin` | `temurin` |
    | `adoptopenjdk` | `temurin` |
    | `zulu` | `zulu` |
    | `corretto` | `corretto` |
    | `liberica` | `liberica` |
    | `microsoft` | `microsoft` |
    | `semeru`, `ibm` | `semeru` |
    | `dragonwell` | `dragonwell` |
    | `graalvm`, `oracle-graalvm` | `graalvm` |
    | `graalvm-community` | `graalvm-community` |
    | `oracle` | `oracle` |
    | `sapmachine` | `sapmachine` |
    | `kona` | `kona` |
    | `jetbrains` | `jetbrains` |

  * In `.sdkmanrc` file, java version should be preceded by the `java=` prefix (e.g., `java=17.0.7-tem`). When a recognized SDKMAN distribution suffix is present, setup-java can infer the `distribution` input automatically. Unrecognized suffixes require setting `distribution` explicitly. The `.sdkmanrc` file supports version specifications in accordance with [file format](https://sdkman.io/usage#env-command), see [Sdkman! documentation](https://sdkman.io/jdks) for more information.

    Supported SDKMAN suffix mappings:

    | SDKMAN suffix | setup-java distribution |
    | ------------- | ----------------------- |
    | `tem` | `temurin` |
    | `sem` | `semeru` |
    | `albba`, `dragonwell` | `dragonwell` |
    | `zulu` | `zulu` |
    | `amzn` | `corretto` |
    | `graal`, `graalce` | `graalvm` |
    | `librca` | `liberica` |
    | `ms` | `microsoft` |
    | `oracle` | `oracle` |
    | `sapmchn` | `sapmachine` |
    | `jbr` | `jetbrains` |
    | `kona` | `kona` |

    
  If both `java-version` and `java-version-file` **inputs** are provided, the `java-version` input will be used.

**Example step using `Sdkman!`** (distribution inferred from `.sdkmanrc`):
```yml
  - name: Setup java
    uses: actions/setup-java@v5
    with:
      java-version-file: '.sdkmanrc'
```

**Example `.sdkmanrc`**:
```
java=17.0.7-tem
```

**Example step using `asdf`** (distribution inferred from `.tool-versions`):
```yml
  - name: Setup java
    uses: actions/setup-java@v5
    with:
      java-version-file: '.tool-versions'
```

**Example `.tool-versions`**:
```
java temurin-17.0.7+7
```

Valid entry options (does not apply to `.sdkmanrc`):
```
major versions: 8, 11, 16, 17, 21
more specific versions: 8.0.282+8, 8.0.232, 11.0, 11.0.4, 17.0
early access (EA) versions: 15-ea, 15.0.0-ea
versions with specified distribution: openjdk64-11.0.2
LTS versions : temurin-21.0.5+11.0.LTS
```
If the file contains multiple versions, only the first one will be recognized.

***NOTE***:
For the tool-version file, ensure that you use standard semantic versioning (semver) formats, as non-standard formats (such as jetbrains-21b212.1) may not be parsed correctly. Additionally, for complex version strings containing multiple version-like segments (for example, java semeru-openj9-11.0.15+10_openj9-0.32.0), the extraction logic may incorrectly capture the last segment (0.32.0) instead of the main version (11.0.15+10).

## Self-signed certificates and internal CAs (GitHub Enterprise)

When `setup-java` dynamically downloads a JDK, it makes HTTPS requests both to fetch the available version metadata and to download the JDK archive. If your runners sit behind a **TLS-inspecting corporate proxy**, or you are on **GitHub Enterprise Server (GHES)** with an internal certificate authority, those requests can fail with an error such as:

```
Error: self signed certificate in certificate chain
```

This happens because the certificate presented to the runner is signed by an **internal or self-signed CA** that is not part of the runner's default trust store. The download itself is fine — the runner simply cannot verify the certificate chain.

### Recommended fix: trust your internal CA

The secure way to resolve this is to make the runner trust your organization's CA, which keeps TLS verification fully enabled. `setup-java` runs on Node.js, which honors the [`NODE_EXTRA_CA_CERTS`](https://nodejs.org/api/cli.html#node_extra_ca_certsfile) environment variable. Point it at your CA bundle (in PEM format) **before** the `actions/setup-java` step:

```yaml
steps:
  # The CA bundle is already present on the runner image in this example.
  # Alternatively, write it from a secret in a previous step.
  - name: Trust the internal CA
    run: echo "NODE_EXTRA_CA_CERTS=/etc/ssl/certs/internal-ca.pem" >> "$GITHUB_ENV"

  - uses: actions/setup-java@v5
    with:
      distribution: 'temurin'
      java-version: '21'
```

If you keep the certificate in a secret rather than on the runner image, write it to disk first:

```yaml
steps:
  - name: Write and trust the internal CA
    run: |
      echo "${{ secrets.INTERNAL_CA_PEM }}" > "${RUNNER_TEMP}/internal-ca.pem"
      echo "NODE_EXTRA_CA_CERTS=${RUNNER_TEMP}/internal-ca.pem" >> "$GITHUB_ENV"

  - uses: actions/setup-java@v5
    with:
      distribution: 'temurin'
      java-version: '21'
```

For **self-hosted runners**, you can instead install your CA into the operating system's trust store (for example, `update-ca-certificates` on Debian/Ubuntu or `update-ca-trust` on RHEL). This makes the certificate trusted for all tooling on the runner, not just `setup-java`.

### GitHub Enterprise customers

On **GitHub Enterprise Server**, traffic from your runners frequently passes through an organization-managed proxy or terminates TLS at an appliance using a certificate from an internal CA. If your workflows hit the error above, set `NODE_EXTRA_CA_CERTS` to your enterprise CA bundle (or bake the CA into your self-hosted runner image) as shown above. Coordinate with your platform team to obtain the correct PEM bundle for your appliance and proxy chain.

### Security warning: do not disable certificate verification

Do **not** work around this error by disabling TLS verification (for example, by setting `NODE_TLS_REJECT_UNAUTHORIZED=0`). `setup-java` does not verify a pinned checksum or signature of the downloaded archive, so **TLS is effectively the only integrity guarantee** on the JDK download. Disabling verification would expose your workflow to a man-in-the-middle attacker who could serve a tampered JDK — which then becomes the `java` used by the rest of your pipeline, with access to your secrets and credentials. Always extend trust to your CA instead of turning verification off.

### Trusting an internal CA inside the installed JDK

The guidance above makes the **runner** trust your CA so that the JDK can be *downloaded*. That is a separate layer from making the **installed JDK** trust your CA at *application runtime*. If your build steps (Maven/Gradle dependency resolution, integration tests, HTTPS calls from your app, etc.) connect to internal services that present a certificate from your internal CA, the JDK will reject them with errors such as:

```
PKIX path building failed: unable to find valid certification path to requested target
```

The JDK keeps its own trust store — a keystore named `cacerts` under `$JAVA_HOME/lib/security/cacerts` — which is independent of the operating system and Node trust stores. After `setup-java` has run (so that `JAVA_HOME` points at the freshly installed JDK), import your CA into that keystore with `keytool`:

```yaml
steps:
  - uses: actions/setup-java@v5
    with:
      distribution: 'temurin'
      java-version: '21'

  - name: Import internal CA into the JDK trust store
    shell: bash
    run: |
      # Write the CA from a secret (or reference a file already on the runner)
      echo "${{ secrets.INTERNAL_CA_PEM }}" > "${RUNNER_TEMP}/internal-ca.pem"
      keytool -importcert -noprompt \
        -alias internal-ca \
        -file "${RUNNER_TEMP}/internal-ca.pem" \
        -keystore "${JAVA_HOME}/lib/security/cacerts" \
        -storepass changeit
```

Notes and caveats:

- The default keystore password for `cacerts` is `changeit` unless your distribution overrides it.
- On **hosted runners** the change applies only to the current job's JDK and is discarded when the job ends, so include the import step in every job that needs it.
- On **self-hosted runners**, importing into a tool-cache JDK persists for as long as that cached version remains on the runner; if you want it to survive JDK reinstalls, pre-seed the CA into your runner image or re-run the import step each time.
- Prefer giving the certificate a stable, descriptive `-alias` so re-runs are idempotent (re-importing the same alias will fail; add `keytool -delete -alias internal-ca ...` first if you re-run within a long-lived runner).

This documents the post-install workflow; there is no dedicated action input for supplying a custom `cacerts` file.
