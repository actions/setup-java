# Switching to V2
## Java distribution
The major breaking change in V2 is the new mandatory `distribution` input. This field should be specified with one of supported distributions. See [Supported distributions](../README.md#Supported-distributions) for a list of available options.  
Use the `zulu` keyword if you would like to continue using the same distribution as in V1.
```yaml
steps:
- uses: actions/checkout@v2
- uses: actions/setup-java@v2
  with:
    distribution: 'zulu'
    java-version: '11'
    java-package: jdk # optional (jdk or jre) - defaults to jdk
- run: java -cp java HelloWorldApp
```

**General recommendation** — configure CI with the same distribution that is used on your local dev machine.

## Installing custom Java distribution from local file
Since the `distribution` input is required in V2, you should specify it using `jdkfile` to continue installing Java from a local file on the runner
```yaml
steps:
- run: |
    download_url="https://github.com/AdoptOpenJDK/openjdk11-binaries/releases/download/jdk-11.0.10%2B9/OpenJDK11U-jdk_x64_linux_hotspot_11.0.10_9.tar.gz"
    wget -O $RUNNER_TEMP/java_package.tar.gz $download_url
- uses: actions/setup-java@v2
  with:
    distribution: 'jdkfile'
    jdkFile: ${{ runner.temp }}/java_package.tar.gz
    java-version: '11.0.0'
    architecture: x64
```

## Dropping legacy Java version syntax 1.x
V1 supported legacy Java syntax such as `1.8` (same as `8`) and `1.8.0.212` (same as `8.0.212`). 
V2 dropped support for legacy syntax so workflows should be updated accordingly. 
