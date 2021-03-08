# 0. V2 setup-java

Date: 2020-08-24

Status: Proposed

# Context

- The `v1` version of `setup-java` downloads and installs Zulu builds of OpenJDK. There is a huge ask from customers to offer AdoptOpenJDK/Adoptium builds of OpenJDK: https://github.com/actions/setup-java/issues/13

- Zulu and AdoptOpenJDK aren't the only distributions of Java though. Other providers include Oracle OpenJDK or Amazon Corretto and ideally it would be nice to support downloading Java from all providers.

- GitHub Actions virtual environments install and default to AdoptOpenJDK builds of OpenJDK. `setup-java` should give users an option to download and use other distributions that may not be be installed

# Decision

## New input

A new required input parameter (titled `distribution`) will be added to `setup-java` that will allow users to specify the distribution that they would like to download

```yaml
  with:
    java-version: '11'
    distribution: adoptium
```

## Default Behavior

There will be no default distribution that we pick for the user. Users will have to specify a distribution in their YAML or else the action will fail.

Requiring a default version will break users that are pinned to `@main` as they will have no `distribution` specified in their YAML. Telemetry indicates that only a small percentage of users would be effected though. Users pinned to `v1` will be uneffected. This change is meant to not be backward compatible and it is acceptable to change the default behavior because a new major version will be released alongside these changes.

## Extensibility & Documentation

`setup-java` should be structured in such a way that will allow the open source community to easily add support for extra distributions.

Existing code will be restructured so that distribution specific code will be easily separated. Currently the core download logic is in a single file, `installer.ts`. This file will be split up and abstracted out so that there will be no vendor specified logic. Each distribution will have it's own files under `src/distributions` that will contain the core setup logic for a specific distribution. 

```yaml
 ∟ src/
    installer.ts # core installer logic
    distributions/
        ∟ adoptium/ # adoptium (formerly AdoptOpenJDK) specific logic
        ∟ zulu/ # zulu specific logic
        ∟ # future distributions will be added here 
```

The contribution doc (`CONTRIBUTING.md`) will describe how a new distribution should be added and how everything should be structured.

## v2-preview

There will be a `v2-preview` branch that will be created for development and testing. Any changes will first be merged into `v2-preview` branch. After a period of testing & verification, the `v2-preview` branch will be merged into the `main` branch and a `v2` tag will be created. Any [GitHub public documentation](https://docs.github.com/en/actions/language-and-framework-guides/github-actions-for-java) and [starter workflows](https://github.com/actions/starter-workflows) that mention `setup-java` will then be updated to use `v2` instead of `v1`.

## Goals & Anti-Goals

The main focus of the `v2` version of `setup-java` will be to add support for adoptium builds of openJDK in addition to Zulu builds of openJDK. In addition, extensibility will be a priority so that other distributions can be added in the future.

The `setup-java` action has some logic that creates a `settings.xml` file so that it is easier to publish packages. Any improvements or modifications to this logic or anything Gradle/Maven specific will be avoided during the development of the `v2-preview`.

# Consequences

- Users will have more flexibility and the freedom to choose a specific distribution that they would like (AdoptOpenJDK builds of OpenJDK in addition or Zulu builds of OpenJDK)
- `setup-java` will be structured in such a way that will allow for more distributions to be easily added in the future
- A large subset of users pin to `@main` or `@master` instead of to a specific version (`v1`). By introducing a breaking change that now requires a distribution to be specified, many users will have their workflows fail until they go and update their yaml
- Higher maintenance and support burden moving forward