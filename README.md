# setup-java

<p align="left">
  <a href="https://github.com/actions/setup-java"><img alt="GitHub Actions status" src="https://github.com/actions/setup-java/workflows/Main%20workflow/badge.svg"></a>
</p>

This action sets up a java environment for use in actions by:

- optionally downloading and caching a requested version of java by version and adding to PATH. Default downloads are populated from the [Zulu Community distribution of OpenJDK](http://static.azul.com/zulu/bin/)
- registering problem matchers for error output

# Usage

See [action.yml](action.yml)

Basic:
```yaml
steps:
- uses: actions/checkout@v1
- uses: actions/setup-java@v1
  with:
    java-version: '9.0.4' # The JDK version to make available on the path. Takes a whole or semver JDK version, or 1.x syntax (e.g. 1.8 => Jdk 8.x). To specify a specific version for JDK 8 or older use the following pattern (8.0.x)
    java-package: jdk # (jre, jdk, or jdk+fx) - defaults to jdk
    architecture: x64 # (x64 or x86) - defaults to x64
- run: java -cp java HelloWorldApp
```

From local file:
```yaml
steps:
- uses: actions/checkout@v1
- uses: actions/setup-java@v1
  with:
    java-version: '4.0.0'
    architecture: x64
    jdkFile: <path to jdkFile> # Optional - jdkFile to install java from. Useful for versions not found on Zulu Community CDN
- run: java -cp java HelloWorldApp
```

Matrix Testing:
```yaml
jobs:
  build:
    runs-on: ubuntu-16.04
    strategy:
      matrix:
        # test against latest update of each major Java version, as well as specific updates of LTS versions:
        java: [ 1.6, 6.0.83, 7, 7.0.181, 8, 8.0.192, 9.0,x, 10, 11.0.x, 11.0.3, 12, 13 ]
    name: Java ${{ matrix.java }} sample
    steps:
      - uses: actions/checkout@master
      - name: Setup java
        uses: actions/setup-java@v1
        with:
          java-version: ${{ matrix.java }}
      - run: java -cp java HelloWorldApp
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Contributions

Contributions are welcome!  See [Contributor's Guide](docs/contributors.md)
