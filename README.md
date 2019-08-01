# setup-java

This action sets up a java environment for use in actions by:

- optionally downloading and caching a version of java by version and adding to PATH. Downloads from [Azul's Zulu distribution](http://static.azul.com/zulu/bin/).
- registering problem matchers for error output

# Usage

See [action.yml](action.yml)

Basic:
```yaml
steps:
- uses: actions/checkout@latest
- uses: actions/setup-java@v1
  with:
    version: 9.0.4 // The JDK version to make available on the path. Takes a whole or semver Jdk version, or 1.x syntax (e.g. 1.8 => Jdk 8.x)
    architecture: x64 // (x64 or x86) - defaults to x64
- run: java -cp java HelloWorldApp
```

From local file:
```yaml
steps:
- uses: actions/checkout@master
- uses: actions/setup-java@v1
  with:
    version: 4.0.0
    architecture: x64
    jdkFile: <path to jdkFile> // Optional - jdkFile to install java from. Useful for versions not supported by Azul
- run: java -cp java HelloWorldApp
```

Matrix Testing:
```yaml
jobs:
  build:
    strategy:
      matrix:
        java: [ 1.6, 9.0.x, 12.0.2 ]
    name: Java ${{ matrix.java }} sample
    steps:
      - uses: actions/checkout@master
      - name: Setup java
        uses: actions/setup-java@v1
        with:
          version: ${{ matrix.java }}
          architecture: x64
      - run: java -cp java HelloWorldApp
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Contributions

Contributions are welcome!  See [Contributor's Guide](docs/contributors.md)
