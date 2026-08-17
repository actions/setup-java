# Usage
- [Selecting a Java distribution](#Selecting-a-Java-distribution)
  - [Eclipse Temurin](#Eclipse-Temurin)
  - [Zulu](#Zulu)
  - [Liberica](#Liberica)
  - [Liberica Native Image Kit](#Liberica-Native-Image-Kit)
  - [Microsoft](#Microsoft)
  - [IBM Semeru](#IBM-Semeru)
  - [Amazon Corretto](#Amazon-Corretto)
  - [Oracle](#Oracle)
  - [Oracle OpenJDK](#Oracle-OpenJDK)
  - [Alibaba Dragonwell](#Alibaba-Dragonwell)
  - [SapMachine](#SapMachine)
  - [GraalVM](#GraalVM)
  - [GraalVM Community](#GraalVM-Community)
  - [JetBrains](#JetBrains)
  - [Tencent Kona](#Tencent-Kona)
- [Installing custom Java package type](#Installing-custom-Java-package-type)
  - [Package compatibility](#Package-compatibility)
  - [JavaFX Maven project](#JavaFX-Maven-project)
- [Ensuring the Maven cache is complete (plugin dependencies)](#ensuring-the-maven-cache-is-complete-plugin-dependencies)
- [Caching JDK installations](#caching-jdk-installations)
- [Platform and architecture compatibility](#platform-and-architecture-compatibility)
- [Installing custom Java architecture](#Installing-custom-Java-architecture)
- [Installing JDK without setting as default](#Installing-JDK-without-setting-as-default)
- [Installing custom Java distribution from local file](#Installing-Java-from-local-file)
- [Testing against different Java distributions](#Testing-against-different-Java-distributions)
- [Testing against different platforms](#Testing-against-different-platforms)
- [Publishing using Apache Maven](#Publishing-using-Apache-Maven)
- [Publishing to multiple Maven servers](#publishing-to-multiple-maven-servers)
- [Apache Maven with a settings path](#apache-maven-with-a-settings-path)
- [Maven transfer progress (download logs)](#Maven-transfer-progress-download-logs)
- [Java problem matcher (compiler annotations)](#java-problem-matcher-compiler-annotations)
- [Publishing using Gradle](#Publishing-using-Gradle)
- [Hosted Tool Cache](#Hosted-Tool-Cache)
- [Modifying Maven Toolchains](#Modifying-Maven-Toolchains)
- [Java-version file](#Java-version-file)
- [Self-signed certificates and internal CAs (GitHub Enterprise)](#Self-signed-certificates-and-internal-CAs-GitHub-Enterprise)

See [action.yml](../action.yml) for more details on task inputs.

> [!NOTE]
> The examples on this page reference `actions/setup-java@v6`, which is still in
> development on the `main` branch and is not yet published as a release tag. To
> try the V6 features documented here (`cache-jdk`, `force-download`,
> `problem-matcher`, `cache-path`, `cache-read-only`, `java-version: latest`,
> `oracle-openjdk`, and the `*-env-var` input names), reference
> `actions/setup-java@main`. For production workflows use the latest stable
> release, `actions/setup-java@v5`, as shown in the [README](../README.md).

## Selecting a Java distribution
`java-version` and `distribution` select what gets installed. `java-version` may be replaced by `java-version-file`, and `distribution` is optional only when `java-version-file` points to a `.sdkmanrc` or `.tool-versions` file that carries a recognized vendor identifier. In every other case both inputs must be provided. See [Supported distributions](../README.md#Supported-distributions) for a list of available options.

### Eclipse Temurin

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '25'
      java-package: 'jdk+jmods' # optional, includes JMOD files with JDK 24 and later
  - run: java --version
```

### Zulu

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'zulu'
      java-version: '25'
      java-package: jdk # optional (jdk, jre, jdk+fx, jre+fx, jdk+crac, or jre+crac) - defaults to jdk
  - run: java --version
```

### Red Hat Build of OpenJDK

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'redhat'
      java-version: '21'
      java-package: jdk # optional (jdk or jre) - defaults to jdk
  - run: java --version
```

### Liberica

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
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
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'liberica-nik'
      java-version: '25'
      java-package: jdk # optional (jdk or jdk+fx) - defaults to jdk
  - run: native-image --version
```

### Microsoft

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'microsoft'
      java-version: '25'
  - run: java --version
```

### Using Microsoft distribution on GHES

`setup-java` comes pre-installed on the appliance with GHES if Actions is enabled. When dynamically downloading the Microsoft Build of OpenJDK distribution, `setup-java` makes a request to `actions/setup-java` to get available versions on github.com (outside of the appliance). These calls to `actions/setup-java` are made via unauthenticated requests, which are limited to [60 requests per hour per IP](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting). If more requests are made within the time frame, then you will start to see rate-limit errors during downloading that looks like: `##[error]API rate limit exceeded for...`.

To get a higher rate limit, you can [generate a personal access token on github.com](https://github.com/settings/tokens/new) and pass it as the `token` input for the action:

```yaml
uses: actions/setup-java@v6
with:
  token: ${{ secrets.GH_DOTCOM_TOKEN }}
  distribution: 'microsoft'
  java-version: '25'
```

If the runner is not able to access github.com, any Java versions requested during a workflow run must come from the runner's tool cache. See "[Setting up the tool cache on self-hosted runners without internet access](https://docs.github.com/en/enterprise-server@3.2/admin/github-actions/managing-access-to-actions-from-githubcom/setting-up-the-tool-cache-on-self-hosted-runners-without-internet-access)" for more information.

### IBM Semeru
**NOTE:** IBM Semeru Runtime Open Edition provides OpenJ9-based builds. Stable releases only; `jdk` and `jre` packages are available.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'semeru'
      java-version: '21'
      java-package: jdk # optional (jdk or jre) - defaults to jdk
  - run: java --version
```

### Amazon Corretto
**NOTE:** Amazon Corretto only supports the major version specification.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'corretto'
      java-version: '25'
  - run: java --version
```

### Oracle
**NOTE:** Oracle Java SE Development Kit is only available for version 17 and later.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'oracle'
      java-version: '25'
  - run: java --version
```

### Oracle OpenJDK
Oracle OpenJDK builds are created and hosted by Oracle under GPLv2+CE. To install the latest early-access build for a feature release, append `-ea` to the Java version:

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'oracle-openjdk'
      java-version: '27-ea'
  - run: java --version
```

Using `27` without the `-ea` suffix selects a stable (GA) release. Oracle archives OpenJDK builds after a limited number of releases and no longer provides security updates for them. To continue receiving security patches, move to Oracle JDK or choose a different vendor.

### Alibaba Dragonwell
**NOTE:** Alibaba Dragonwell only provides jdk.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'dragonwell'
      java-version: '8'
  - run: java --version
```

### SapMachine
**NOTE:** An OpenJDK release maintained and supported by SAP
```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'sapmachine'
      java-version: '25'
  - run: java --version
```

### GraalVM
**NOTE:** Oracle GraalVM is only available for JDK 17 and later.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
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
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
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
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'jetbrains'
      java-version: '11'
  - run: java --version
```

The JetBrains installer uses the GitHub API to fetch the latest version. If you believe your project is going to be running into rate limits, you can provide a
GitHub token to the action to increase the rate limit. Set the `GITHUB_TOKEN` environment variable to the value of your GitHub token in the workflow file.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
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
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'kona'
      java-version: '21'
  - run: java --version
```

## Installing custom Java package type

The `java-package` input selects the vendor artifact to install. It defaults to
`jdk`. Package availability is a combination of distribution, Java version,
operating system, and architecture; a package listed below can still be absent
for a particular platform or patch release. Unless a fixed version range is
called out, `setup-java` queries the distribution's catalog and installs the
newest artifact matching `java-version`.

The package types have these meanings:

- `jdk` and `jre` select a development kit or runtime image, respectively.
- `+fx` selects a vendor bundle that includes JavaFX.
- `+crac` selects an Azul Zulu build with CRaC support.
- `+jmods` installs the Temurin JDK and adds its separately published JMOD
  archive when the JDK does not already contain a `jmods` directory.
- `+jcef` and `+ft` select JetBrains Runtime bundles with JCEF or FreeType.

### Package compatibility

| Distribution | Supported `java-package` values | Version support and important details |
| --- | --- | --- |
| `temurin` | `jdk`, `jre`, `jdk+jmods` | `jdk` and `jre` follow the Adoptium catalog. `jdk+jmods` is available for Java 24 and later and resolves both artifacts at the exact same Java version. |
| `zulu` | `jdk`, `jre`, `jdk+fx`, `jre+fx`, `jdk+crac`, `jre+crac` | Standard JDK builds go back to Java 6; JRE and JavaFX bundles start at Java 8. The vendor catalog has gaps among older non-LTS releases. CRaC bundles start at Java 17 and have more limited OS and architecture availability. |
| `liberica` | `jdk`, `jre`, `jdk+fx`, `jre+fx` | Standard JDK builds go back to Java 8 in the supported action catalog; JRE and JavaFX "full" bundles also start at Java 8. Exact versions follow BellSoft's catalog for the requested platform. |
| `liberica-nik` | `jdk`, `jdk+fx` | `java-version` selects the embedded JDK version, not the NIK/GraalVM release number. BellSoft currently publishes matching standard and JavaFX "full" bundles for JDK 11 and later, with gaps between feature releases. Any other `java-package` value is rejected. |
| `microsoft` | `jdk` | Stable builds only. The bundled manifest contains Java 11, 16, 17, 21, and 25 releases; platform availability varies by release. |
| `semeru` | `jdk`, `jre` | Stable OpenJ9 builds only. IBM publishes both image types for the supported release lines (currently 8, 11, 17, 21, and 25), subject to platform availability. |
| `corretto` | `jdk`, `jre` | Accepts major versions only. JDK availability follows Amazon's platform catalog. For the operating systems directly selected by `setup-java`, JRE downloads are limited to Java 8 on Windows; Linux and macOS use `jdk`. |
| `oracle` | `jdk` | Stable Oracle JDK 17 and later only. |
| `oracle-openjdk` | `jdk` | Installs the GA or early-access JDK builds currently listed or archived on `jdk.java.net`; use a `-ea` version such as `27-ea` for early access. |
| `redhat` | `jdk`, `jre` | Stable builds only. Version availability follows the Foojay Disco catalog for Red Hat Build of OpenJDK and can lag Red Hat's downloads page. |
| `dragonwell` | `jdk` | Stable builds only. The current vendor catalog provides Java 8, 11, 17, 21, and 25. |
| `sapmachine` | `jdk`, `jre` | Follows the SapMachine catalog. Both editions are represented from Java 10 onward, but individual versions and platforms can differ. |
| `graalvm` | `jdk` | Stable Oracle GraalVM for JDK 17 and later only. |
| `graalvm-community` | `jdk` | Stable GraalVM Community releases for JDK 17 and later only. |
| `jetbrains` | `jdk`, `jre`, `jdk+jcef`, `jre+jcef`, `jdk+ft`, `jre+ft` | JetBrains publishes selected LTS-based releases rather than every OpenJDK patch. JDK/JRE and JCEF bundles start with the Java 11 release family; FreeType bundles start with Java 17. Exact package, LTS family, patch, OS, and architecture availability is determined from release assets. |
| `kona` | `jdk` | Stable Java 8, 11, 17, 21, and 25 releases only. |
| `jdkfile` | `jdk` | The package contents and version are supplied by `jdk-file`; `setup-java` validates the package type but does not inspect the archive contents. |

Values outside this table are unsupported. The action rejects them before
checking the tool cache or requesting a vendor catalog.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'semeru'
      java-version: '21'
      java-package: jre
  - run: java --version
```

### JavaFX Maven project

For JavaFX projects that use Maven, use `jdk+fx` (or `jre+fx`) as the `java-package` value together with a distribution that supports it (e.g. `zulu` or `liberica`). Then include the [`javafx-maven-plugin`](https://openjfx.io/openjfx-docs/#maven) in your `pom.xml` as described in the [Getting Started with JavaFX](https://openjfx.io/openjfx-docs/#maven) guide.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
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
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
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
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v6
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
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v6
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

## Caching JDK installations

`cache-jdk` controls caching for downloaded JDK installations. The JDK cache is
stored and restored as its own cache entry, separate from the dependency and
build-tool wrapper caches selected by `cache`. Whether it is *enabled*, however,
is coupled to `cache`: setting `cache` turns JDK caching on as well, unless
`cache-jdk` is set explicitly.

| `cache` | `cache-jdk` | Dependency and wrapper caches | JDK cache |
| --- | --- | --- | --- |
| Omitted | Omitted | Disabled | Disabled |
| Omitted | `true` | Disabled | Enabled |
| Omitted | `false` | Disabled | Disabled |
| Set | Omitted | Enabled | Enabled |
| Set | `true` | Enabled | Enabled |
| Set | `false` | Enabled | Disabled |

JDK entries are specific to the runner operating system and normalized
architecture. They are additionally separated by distribution, package type,
exact resolved Java version, release identity, and signature-verification
identity. The release identity is the authoritative checksum when available and
otherwise the download URL without its query string. These dimensions prevent
incompatible JDKs from sharing an entry. They also mean that a matrix or workflow
using multiple JDK versions, distributions, package types, architectures, or
operating systems stores a separate JDK entry for each identity and consumes
cache storage for each one.

For `distribution: jdkfile`, the release source is a SHA-256 hash of the local
`jdk-file` contents, streamed so the archive is not held in memory. Changing the
archive therefore creates a different JDK cache entry, even when its path and
requested version are unchanged. The archive is only read when the runner tool
cache holds no installation satisfying the requested version: a matching
tool-cache installation short-circuits setup, so a changed `jdk-file` is not
re-extracted for a version that is already installed. Use
`force-download: true` when the archive contents change but the version does not.

The verification identity separates unverified downloads from packages verified
with the distribution's bundled signing key and from packages verified with each
custom key. Custom public keys are represented by a SHA-256 fingerprint of
normalized key material; the key itself is not placed in the cache key, the logs,
or action state. A verified exact-key hit reuses content that was
signature-verified when it was downloaded by the run that saved the entry,
instead of downloading and verifying it again.

> [!IMPORTANT]
> The JDK cache **key** is what isolates verification modes and release
> identity: a JDK cache entry created by an unverified download can never be
> restored for a request that sets `verify-signature: true`, and vice versa.
> `cache-jdk` does not change how the runner tool cache is used. setup-java
> first looks for an installation in the runner tool cache — a preinstalled
> JDK, or one installed by an earlier step of the same job — and uses it as-is. Such an installation is not downloaded again, and its checksum
> and signature are not reverified, even when `verify-signature: true` is set,
> because its verification history is not recorded in the tool cache. Use
> `force-download: true` for a request that must download and verify the archive
> itself.

`check-latest: true` and `java-version: latest` resolve remote metadata before
looking up the exact resolved JDK entry. `force-download: true` bypasses both the
runner tool cache and JDK cache restore, but an enabled JDK cache still records
the downloaded installation for a post-job save. `cache-read-only: true` allows
restores but suppresses post-job saves for JDK, dependency, and wrapper caches.

If the cache service fails to restore an entry, or the restored entry lacks the
expected completed tool-cache path, setup continues by downloading the JDK.
Post-job saves are best-effort and do not fail the job: cache keys are immutable,
so an existing key or a concurrent job winning the save race is left unchanged,
and a failure to save one JDK entry is reported as a warning without preventing
the remaining entries from being saved.

A key is only ever populated with the installation it was computed for. Because
tool-cache paths are shared per version and architecture, a later step — for
example one using `force-download: true` — can replace the installation an
earlier step registered. setup-java detects that replacement in the post-job
step and skips the save with a warning, so a key is never saved with content
other than the installation it identifies. This guarantee holds without
rehashing hundreds of megabytes of JDK content on every job.

### Caching release resolution

Only Temurin is preinstalled in the runner tool cache, so for every other
distribution setup-java has to ask the distribution's metadata API which release
satisfies `java-version` before it can look up a JDK cache entry. That makes the
vendor API a dependency of every job, even one whose JDK is already cached.

When JDK caching is enabled, setup-java also stores the resolved release itself
in a small companion cache entry, keyed on the runner operating system,
architecture, distribution, package type, requested version, and stability. A job
that finds a current entry installs the JDK without contacting the distribution's
metadata API at all.

Entries carry the seven-day window they were resolved in. An entry from an
earlier window is not used directly: setup-java still queries the metadata API,
so a floating request such as `java-version: 21` keeps picking up new releases.
The older entry is used only when that query fails, which keeps a job working
through a vendor outage or rate limit. Because the entry also holds the download
URL and checksum, this fallback works even when the JDK itself is not cached and
still has to be downloaded. When the fallback is used, setup-java reports it with
a warning.

Seven days is deliberate. GitHub removes cache entries that have not been
accessed for seven days, so a longer window would mean the previous entry is
already evicted by the time the window rolls over, leaving no fallback at the
moment one is most likely to be needed. It also comfortably covers JDK release
cadence, which is monthly at its fastest and usually quarterly, and it means a
repository whose workflows run infrequently still benefits. Use
`check-latest: true` for a workflow that must resolve the newest release on every
run.

Restored entries are validated before use: the download URL and any signature URL
must be well-formed HTTPS URLs and the checksum must use a supported algorithm.
An entry that fails validation is ignored and the metadata API is queried
instead. `check-latest: true`, `java-version: latest`, and `force-download: true`
always query the metadata API and never read or write these entries.

Releases whose download URL is not content-addressed are never stored. Oracle JDK
and Oracle GraalVM build a `/latest/` URL when `java-version` names only a major
version, and the bytes behind that URL change whenever a new build is published,
so its URL and checksum are only consistent with each other at the moment they
are resolved. Requesting a more specific version, such as `java-version: 21.0.2`,
resolves an archived URL that is stored normally.

JDK caching trades cache storage and cold-run save work for faster warm setup.
A warm run restores the installed JDK instead of downloading, verifying, and
extracting it, while the first run pays to upload it and every cached identity
consumes repository cache storage. How much time this saves depends on the
runner, distribution, JDK size, network, and cache eviction pressure.

## Platform and architecture compatibility

The `architecture` input is normalized before setup-java checks the tool cache
or contacts a vendor. `amd64`, `ia32`, `arm`, and `arm64` are accepted aliases
for `x64`, `x86`, `armv7`, and `aarch64`. The table lists the combinations
setup-java validates up front; an individual Java patch release can still be
absent from a vendor catalog.

| Distribution | Linux | macOS | Windows | Other / version restrictions |
| --- | --- | --- | --- | --- |
| `temurin` | `x64`, `x86`, `armv7`, `aarch64`, `ppc64le`, `s390x` | `x64`, `aarch64` | `x64`, `x86`, `aarch64` | Linux `armv7` is available through Java 17. |
| `zulu` | `x64`, `x86`, `armv7`, `aarch64` | `x64`, `aarch64` | `x64`, `x86`, `aarch64` | |
| `liberica` | `x64`, `x86`, `armv7`, `aarch64`, `ppc64le` | `x64`, `aarch64` | `x64`, `x86`, `aarch64` | Solaris: `x64`. |
| `liberica-nik` | `x64`, `aarch64` | `x64`, `aarch64` | `x64`, `aarch64` | |
| `microsoft` | `x64`, `aarch64` | `x64`, `aarch64` | `x64`, `aarch64` | |
| `semeru` | `x64`, `x86`, `ppc64le`, `ppc64`, `s390x`, `aarch64` | `x64`, `aarch64` | `x64`, `aarch64` | |
| `corretto` | `x64`, `x86`, `armv7`, `aarch64` | `x64`, `aarch64` | `x64`, `x86` | `x86` is limited to Java 11 or earlier; Linux `armv7` is available for Java 11. |
| `oracle` | `x64`, `aarch64` | `x64`, `aarch64` | `x64` | |
| `oracle-openjdk` | `x64`, `aarch64` | `x64`, `aarch64` | `x64` | |
| `redhat` | `x64`, `aarch64`, `ppc64le` | — | `x64`, `x86` | Linux requires glibc; Alpine is unsupported. Linux `aarch64` and `ppc64le` are limited to Java 11 or earlier. Windows `x64` is limited to Java 21 or earlier and `x86` to Java 10 or earlier. |
| `dragonwell` | `x64`, `aarch64` | — | `x64` | |
| `sapmachine` | `x64`, `aarch64`, `ppc64le` | `x64`, `aarch64` | `x64`, `aarch64` | |
| `graalvm`, `graalvm-community` | `x64`, `aarch64` | `x64`, `aarch64` | `x64` | |
| `jetbrains` | `x64`, `aarch64` | `x64`, `aarch64` | `x64`, `aarch64` | |
| `kona` | `x64`, `aarch64` | `x64`, `aarch64` | `x64` | |
| `jdkfile` | Any | Any | Any | Local archives are not restricted because setup-java does not inspect their contents. |

Unsupported combinations fail with a platform-capability error before a cache
lookup or vendor request. A supported combination can still produce a
version-not-found error when the requested release was not published.

## Installing custom Java architecture

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
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
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '17'
  - uses: actions/setup-java@v6
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
> This approach also lets you use builds that setup-java does not provide directly, such as unreleased Loom/Valhalla preview builds or early-access builds not exposed by a supported distribution. Download the desired archive in a prior step and point `jdk-file` at it; setup-java will extract, install, and cache it just like a supported distribution. When targeting multiple architectures, select the correct binary per architecture in your workflow (for example, with a build matrix).

```yaml
steps:
  - run: |
      download_url="https://github.com/adoptium/temurin11-binaries/releases/download/jdk-11.0.12%2B7/OpenJDK11U-jdk_x64_linux_hotspot_11.0.12_7.tar.gz"
      wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
  - uses: actions/setup-java@v6
    with:
      distribution: 'jdkfile'
      jdk-file: ${{ runner.temp }}/java_package.tar.gz
      java-version: '11.0.0'
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

  - uses: actions/setup-java@v6
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
    runs-on: ubuntu-latest
    strategy:
      matrix:
        distribution: [ 'zulu', 'temurin' ]
        java: [ '8', '11' ]
    name: Java ${{ matrix.Java }} (${{ matrix.distribution }}) sample
    steps:
      - uses: actions/checkout@v7
      - name: Setup java
        uses: actions/setup-java@v6
        with:
          distribution: ${{ matrix.distribution }}
          java-version: ${{ matrix.java }}
      - run: java --version
```

## Testing against different platforms
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
      - uses: actions/checkout@v7
      - name: Setup java
        uses: actions/setup-java@v6
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
      - uses: actions/checkout@v7
      - name: Set up JDK 11
        uses: actions/setup-java@v6
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
        uses: actions/setup-java@v6
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

### Publishing to multiple Maven servers

Use `mvn-server-credentials` to add more than one credential entry to the generated `settings.xml`. Each line has the format `server-id:USERNAME_ENV:PASSWORD_ENV`. The username and password fields are environment variable names, not credential values.

When this input is set, it replaces the single server configured by `server-id`, `server-username-env-var`, and `server-password-env-var`.

```yaml
steps:
  - uses: actions/checkout@v7
  - name: Set up release and snapshot repositories
    uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '21'
      mvn-server-credentials: |
        releases:RELEASES_USERNAME:RELEASES_PASSWORD
        snapshots:SNAPSHOTS_USERNAME:SNAPSHOTS_PASSWORD
  - name: Publish with Maven
    run: mvn deploy
    env:
      RELEASES_USERNAME: ${{ secrets.RELEASES_USERNAME }}
      RELEASES_PASSWORD: ${{ secrets.RELEASES_PASSWORD }}
      SNAPSHOTS_USERNAME: ${{ secrets.SNAPSHOTS_USERNAME }}
      SNAPSHOTS_PASSWORD: ${{ secrets.SNAPSHOTS_PASSWORD }}
```

This configuration produces the following server entries:

```xml
<servers>
  <server>
    <id>releases</id>
    <username>${env.RELEASES_USERNAME}</username>
    <password>${env.RELEASES_PASSWORD}</password>
  </server>
  <server>
    <id>snapshots</id>
    <username>${env.SNAPSHOTS_USERNAME}</username>
    <password>${env.SNAPSHOTS_PASSWORD}</password>
  </server>
</servers>
```

### Resolving Maven dependencies from custom repositories

Use `mvn-repositories` when Maven must download dependencies from repositories
outside Maven Central. Each line has the format
`repository-id:repository-url:snapshots-enabled`. The parser uses the first and
last colons as separators, so repository URLs can contain a scheme or port.

The repository ID can match a `mvn-server-credentials` server ID to authenticate
requests to a private repository:

```yaml
steps:
  - uses: actions/checkout@v7
  - name: Set up Java and private Maven repositories
    uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '21'
      mvn-server-credentials: |
        private:PRIVATE_REPOSITORY_USERNAME:PRIVATE_REPOSITORY_TOKEN
      mvn-repositories: |
        private:https://maven.example.com:8443/releases:false
        snapshots:https://maven.example.com:8443/snapshots:true
      mvn-repositories-include-central: true
      mvn-repositories-prioritize-central: true
  - run: mvn --batch-mode verify
    env:
      PRIVATE_REPOSITORY_USERNAME: ${{ secrets.PRIVATE_REPOSITORY_USERNAME }}
      PRIVATE_REPOSITORY_TOKEN: ${{ secrets.PRIVATE_REPOSITORY_TOKEN }}
```

This configuration adds the following active profile to `settings.xml`:

```xml
<profiles>
  <profile>
    <id>setup-java-repositories</id>
    <repositories>
      <repository>
        <id>central</id>
        <url>https://repo.maven.apache.org/maven2</url>
        <snapshots>
          <enabled>false</enabled>
        </snapshots>
      </repository>
      <repository>
        <id>private</id>
        <url>https://maven.example.com:8443/releases</url>
        <snapshots>
          <enabled>false</enabled>
        </snapshots>
      </repository>
      <repository>
        <id>snapshots</id>
        <url>https://maven.example.com:8443/snapshots</url>
        <snapshots>
          <enabled>true</enabled>
        </snapshots>
      </repository>
    </repositories>
  </profile>
</profiles>
<activeProfiles>
  <activeProfile>setup-java-repositories</activeProfile>
</activeProfiles>
```

Maven Central is included first by default. Set
`mvn-repositories-prioritize-central: false` to place custom repositories
first, or set `mvn-repositories-include-central: false` to disable Central. The
generated profile overrides the Central repository inherited from Maven's Super
POM with releases and snapshots disabled. When automatic Central inclusion is
off, the ID `central` may instead be declared explicitly in `mvn-repositories`
to replace it with a user-specified repository; otherwise that ID is reserved
to prevent duplicate entries.

### GPG

The example above uses the [Maven GPG Plugin](https://maven.apache.org/plugins/maven-gpg-plugin/)'s Bouncy Castle signer (`-Dgpg.signer=bc`, available since `maven-gpg-plugin` 3.2.0). It is a pure-Java signer that reads the key directly from the `MAVEN_GPG_KEY` environment variable, so it does **not** require the `gpg` executable, importing the key into a GPG keychain, or the `--pinentry-mode loopback` workaround in your `pom.xml`. The key must be an ASCII-armored secret key (transferable secret key format).

**GPG key should be exported by: `gpg --armor --export-secret-keys YOUR_ID`**

See the help docs on [Publishing a Package](https://help.github.com/en/github/managing-packages-with-github-packages/configuring-apache-maven-for-use-with-github-packages#publishing-a-package) for more information on the `pom.xml` file.

#### Legacy / alternative: let setup-java import the key

If you prefer signing with the `gpg` executable (for example because you are using `maven-gpg-plugin` older than 3.2.0), you can let setup-java import the key instead by providing the `gpg-private-key` and `gpg-passphrase-env-var` inputs. setup-java creates a uniquely named, permission-restricted GPG home in the runner's temp directory, imports the key only into that isolated keyring, and exports `GNUPGHOME` for subsequent Maven and GPG commands. The temporary key file is permission-restricted and removed whether the import succeeds or fails. A cleanup step removes the complete action-owned GPG home after the job regardless of job status, without modifying the runner user's default keyring. Each setup-java invocation owns a separate keyring, including on persistent self-hosted runners.

setup-java imports the key independently of the plugin version, but the generated passphrase profile described below uses `gpg.passphraseEnvName`, which requires `maven-gpg-plugin` 3.2.0 or newer. Since `gpg-passphrase-env-var` defaults to `GPG_PASSPHRASE`, setup-java writes that profile unless you override the input to `MAVEN_GPG_PASSPHRASE`.

```yaml
    - name: Set up Apache Maven Central
      uses: actions/setup-java@v6
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
      - uses: actions/checkout@v7
      - name: Set up JDK 11 for Shared Runner
        uses: actions/setup-java@v6
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
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v6
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
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v6
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
      - uses: actions/checkout@v7

      - name: Set up JDK 11
        uses: actions/setup-java@v6
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

Currently, LTS versions of Eclipse Temurin (`temurin`) are cached on GitHub-hosted runners. Using a cached version avoids downloading a JDK.

The tools cache gets updated on a weekly basis. See the installed Java versions for [Ubuntu](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md#java), [Windows](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md#java), and [macOS](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md#java).

## Modifying Maven Toolchains
The `setup-java` action generates a basic [Maven Toolchains declaration](https://maven.apache.org/guides/mini/guide-using-toolchains.html) for specified Java versions by either creating a minimal toolchains file or extending an existing declaration with the additional JDKs.

### Installing Multiple JDKs With Toolchains
Subsequent calls to `setup-java` with distinct distribution and version parameters will continue to extend the toolchains declaration and make all specified Java versions available.

Toolchain entries are always merged non-destructively: existing JDK, custom, and user-managed toolchains are preserved, and only an entry with the exact same `type` and `provides.id` is replaced. This behavior is independent of the `overwrite-settings` input, which only controls regeneration of `settings.xml`. As a result, running `setup-java` several times in the same job (for example in multiple steps or with multiple `java-version` values) accumulates every JDK in `toolchains.xml` instead of dropping previously registered entries.

```yaml
steps:
  - uses: actions/setup-java@v6
    with:
      distribution: '<distribution>'
      java-version: |
        8
        11

  - uses: actions/setup-java@v6
    with:
      distribution: '<distribution>'
      java-version: '15'
```

The result is a Toolchain with entries for JDKs 8, 11 and 15. You can even combine this with custom JDKs of arbitrary versions:

```yaml
- run: |
    download_url="https://example.com/java/jdk/6u45-b06/jdk-6u45-linux-x64.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v6
  with:
    distribution: 'jdkfile'
    jdk-file: ${{ runner.temp }}/java_package.tar.gz
    java-version: '1.6'
    architecture: x64
```

This will generate a Toolchains entry with the following values: `version: 1.6`, `vendor: jdkfile`, `id: jdkfile_1.6`.

### Modifying The Toolchain Vendor For JDKs
Each JDK provider will receive a default `vendor` using the `distribution` input value but this can be overridden with the `mvn-toolchain-vendor` parameter as follows.

```yaml
- run: |
    download_url="https://example.com/java/jdk/6u45-b06/jdk-6u45-linux-x64.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v6
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
  - uses: actions/setup-java@v6
    with:
      distribution: '<distribution>'
      java-version: |
        8
        11
      mvn-toolchain-vendor: Eclipse Temurin
```

### Modifying The Toolchain ID For JDKs
Each JDK provider will receive a default `id` based on the combination of the toolchain vendor and `java-version` in the format of `vendor_java-version` (e.g. `temurin_11`). The vendor defaults to the `distribution` input, so overriding `mvn-toolchain-vendor` also changes the generated default `id`. Set `mvn-toolchain-id` to override the `id` directly.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '11'
      mvn-toolchain-id: 'some_other_id'
  - run: java --version
```

When installing multiple Java versions, use the same multiline syntax as `java-version`. You must declare exactly one ID for every Java version that will be installed. The action fails before installing a JDK unless the number of `mvn-toolchain-id` entries matches the number of `java-version` entries, or is exactly one when `java-version-file` is used.

```yaml
steps:
  - uses: actions/setup-java@v6
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
    uses: actions/setup-java@v6
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
    uses: actions/setup-java@v6
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

  - uses: actions/setup-java@v6
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

  - uses: actions/setup-java@v6
    with:
      distribution: 'temurin'
      java-version: '21'
```

For **self-hosted runners**, you can instead install your CA into the operating system's trust store (for example, `update-ca-certificates` on Debian/Ubuntu or `update-ca-trust` on RHEL). This makes the certificate trusted for all tooling on the runner, not just `setup-java`.

### GitHub Enterprise customers

On **GitHub Enterprise Server**, traffic from your runners frequently passes through an organization-managed proxy or terminates TLS at an appliance using a certificate from an internal CA. If your workflows hit the error above, set `NODE_EXTRA_CA_CERTS` to your enterprise CA bundle (or bake the CA into your self-hosted runner image) as shown above. Coordinate with your platform team to obtain the correct PEM bundle for your appliance and proxy chain.

### Security warning: do not disable certificate verification

Do **not** work around this error by disabling TLS verification (for example, by setting `NODE_TLS_REJECT_UNAUTHORIZED=0`). Disabling verification would expose your workflow to a man-in-the-middle attacker who could serve a tampered JDK — which then becomes the `java` used by the rest of your pipeline, with access to your secrets and credentials. It also weakens the version metadata requests, which are not checksum-verified at all: a tampered manifest can redirect setup-java to an attacker-controlled download URL. `setup-java` does verify authoritative checksums for [supported distributions](../README.md#download-integrity-and-signatures), and can verify package signatures with `verify-signature: true`, but those checks are not a substitute for a trusted TLS chain. Always extend trust to your CA instead of turning verification off.

### Trusting an internal CA inside the installed JDK

The guidance above makes the **runner** trust your CA so that the JDK can be *downloaded*. That is a separate layer from making the **installed JDK** trust your CA at *application runtime*. If your build steps (Maven/Gradle dependency resolution, integration tests, HTTPS calls from your app, etc.) connect to internal services that present a certificate from your internal CA, the JDK will reject them with errors such as:

```
PKIX path building failed: unable to find valid certification path to requested target
```

The JDK keeps its own trust store — a keystore named `cacerts` under `$JAVA_HOME/lib/security/cacerts` — which is independent of the operating system and Node trust stores. After `setup-java` has run (so that `JAVA_HOME` points at the freshly installed JDK), import your CA into that keystore with `keytool`:

```yaml
steps:
  - uses: actions/setup-java@v6
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
