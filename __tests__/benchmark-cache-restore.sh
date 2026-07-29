#!/usr/bin/env bash

set -euo pipefail

command=${1:?command is required}
tool=${2:?tool is required}

case "$tool" in
  maven)
    dependency_cache="$HOME/.m2/repository"
    wrapper_cache="$HOME/.m2/wrapper/dists"
    dependency_file="benchmark/pom.xml"
    wrapper_file="benchmark/.mvn/wrapper/maven-wrapper.properties"
    ;;
  gradle)
    dependency_cache="$HOME/.gradle/caches"
    wrapper_cache="$HOME/.gradle/wrapper"
    dependency_file="benchmark/build.gradle"
    wrapper_file="benchmark/gradle/wrapper/gradle-wrapper.properties"
    ;;
  *)
    echo "Unsupported tool: $tool" >&2
    exit 1
    ;;
esac

case "$command" in
  prepare)
    profile=${3:?profile is required}
    mkdir -p "$(dirname "$dependency_file")" "$(dirname "$wrapper_file")"
    printf '// setup-java cache benchmark v1: %s\n' "$profile" > "$dependency_file"
    printf '# setup-java cache benchmark v1: %s\n' "$profile" > "$wrapper_file"
    ;;
  reset)
    rm -rf "$dependency_cache" "$wrapper_cache"
    ;;
  populate)
    profile=${3:?profile is required}
    case "$profile" in
      small)
        dependency_megabytes=8
        wrapper_megabytes=2
        ;;
      large)
        dependency_megabytes=128
        wrapper_megabytes=32
        ;;
      *)
        echo "Unsupported profile: $profile" >&2
        exit 1
        ;;
    esac
    mkdir -p "$dependency_cache/setup-java-benchmark"
    mkdir -p "$wrapper_cache/setup-java-benchmark"
    dd if=/dev/urandom \
      of="$dependency_cache/setup-java-benchmark/payload" \
      bs=1048576 count="$dependency_megabytes" 2>/dev/null
    dd if=/dev/urandom \
      of="$wrapper_cache/setup-java-benchmark/payload" \
      bs=1048576 count="$wrapper_megabytes" 2>/dev/null
    ;;
  start)
    node -e "require('fs').writeFileSync('.benchmark-start', String(Date.now()))"
    ;;
  record)
    os=${3:?os is required}
    profile=${4:?profile is required}
    implementation=${5:?implementation is required}
    iteration=${6:?iteration is required}
    cache_hit=${7:?cache-hit output is required}
    if [ "$cache_hit" != "true" ]; then
      echo "Expected an exact dependency-cache hit for $implementation" >&2
      exit 1
    fi
    test -f "$dependency_cache/setup-java-benchmark/payload"
    started=$(cat .benchmark-start)
    finished=$(node -e "process.stdout.write(String(Date.now()))")
    elapsed=$((finished - started))
    mkdir -p .benchmark-results
    printf '%s,%s,%s,%s,%s,%s\n' \
      "$os" "$tool" "$profile" "$implementation" "$iteration" "$elapsed" \
      >> .benchmark-results/timings.csv
    ;;
  summarize)
    summary_file=${3:?summary file is required}
    results_file=".benchmark-results/timings.csv"
    node --input-type=module - "$results_file" "$summary_file" <<'NODE'
import fs from 'node:fs';

const [, , resultsFile, summaryFile] = process.argv;
const rows = fs
  .readFileSync(resultsFile, 'utf8')
  .trim()
  .split('\n')
  .map(line => {
    const [os, tool, profile, implementation, iteration, elapsed] =
      line.split(',');
    return {os, tool, profile, implementation, iteration, elapsed: +elapsed};
  });
const average = implementation => {
  const values = rows
    .filter(row => row.implementation === implementation)
    .map(row => row.elapsed);
  if (values.length === 0) {
    throw new Error(`No ${implementation} benchmark results were recorded`);
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};
const baseline = average('baseline');
const candidate = average('candidate');
const change = (((candidate - baseline) / baseline) * 100).toFixed(1);
const {os, tool, profile} = rows[0];
const lines = [
  `### ${tool} ${profile} cache restore on ${os}`,
  '',
  '| Implementation | Iteration | Wall time (ms) |',
  '| --- | ---: | ---: |',
  ...rows.map(
    row =>
      `| ${row.implementation} | ${row.iteration} | ${row.elapsed} |`
  ),
  `| **baseline average** | | **${baseline}** |`,
  `| **candidate average** | | **${candidate}** |`,
  '',
  `Candidate change from baseline: **${change}%**`,
  ''
];
fs.appendFileSync(summaryFile, `${lines.join('\n')}\n`);
NODE
    ;;
  *)
    echo "Unsupported command: $command" >&2
    exit 1
    ;;
esac
