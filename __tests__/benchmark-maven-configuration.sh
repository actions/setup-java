#!/usr/bin/env bash

set -euo pipefail

command=${1:?command is required}

benchmark_home="$PWD/benchmark-maven-home"
results_dir="$PWD/.benchmark-results"
results_file="$results_dir/maven-configuration-timings.csv"
sizes_file="$results_dir/maven-configuration-sizes.csv"

case "$command" in
  prepare)
    cache=${2:?cache profile is required}
    toolchains_profile=${3:?toolchains profile is required}

    rm -rf "$benchmark_home"
    mkdir -p "$benchmark_home" benchmark
    printf '<project />\n' > benchmark/pom.xml
    printf 'plugins { id("java") }\n' > benchmark/build.gradle

    if [ "$toolchains_profile" = "existing" ]; then
      cat > "$benchmark_home/toolchains.xml" <<'XML'
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.0.0 http://maven.apache.org/xsd/toolchains-1.0.0.xsd">
  <toolchain>
    <type>foo</type>
    <provides>
      <custom>preserved</custom>
    </provides>
    <configuration>
      <fooHome>/opt/foo</fooHome>
    </configuration>
  </toolchain>
</toolchains>
XML
    elif [ "$toolchains_profile" != "empty" ]; then
      echo "Unsupported toolchains profile: $toolchains_profile" >&2
      exit 1
    fi

    case "$cache" in
      none | maven | gradle) ;;
      *)
        echo "Unsupported cache profile: $cache" >&2
        exit 1
        ;;
    esac
    ;;
  start)
    mkdir -p "$results_dir"
    node -e "require('fs').writeFileSync('.benchmark-start', String(Date.now()))"
    ;;
  record)
    os=${2:?os is required}
    cache=${3:?cache profile is required}
    versions=${4:?versions profile is required}
    toolchains_profile=${5:?toolchains profile is required}
    implementation=${6:?implementation is required}
    iteration=${7:?iteration is required}

    started=$(cat .benchmark-start)
    finished=$(node -e "process.stdout.write(String(Date.now()))")
    elapsed=$((finished - started))
    mkdir -p "$results_dir"
    printf '%s,%s,%s,%s,%s,%s,%s\n' \
      "$os" "$cache" "$versions" "$toolchains_profile" "$implementation" "$iteration" "$elapsed" \
      >> "$results_file"
    ;;
  record-size)
    implementation=${2:?implementation is required}
    action_path=${3:?action path is required}
    mkdir -p "$results_dir"
    index_bytes=$(node -e "const fs=require('fs'); process.stdout.write(String(fs.statSync(process.argv[1]).size))" "$action_path/dist/setup/index.js")
    js_bytes=$(node -e "const fs=require('fs'); const path=require('path'); let total=0; for (const entry of fs.readdirSync(process.argv[1])) { if (entry.endsWith('.js')) total += fs.statSync(path.join(process.argv[1], entry)).size; } process.stdout.write(String(total));" "$action_path/dist/setup")
    chunk_count=$(find "$action_path/dist/setup" -maxdepth 1 -name '*.js' | wc -l | tr -d ' ')
    xml_parser_chunks=$(grep -Rsl "fast-xml-parser" "$action_path/dist/setup"/*.js 2>/dev/null | xargs -n 1 basename 2>/dev/null | paste -sd ';' - || true)
    printf '%s,%s,%s,%s\n' \
      "$implementation" "$index_bytes" "$js_bytes" "${xml_parser_chunks:-none} ($chunk_count js files)" \
      >> "$sizes_file"
    ;;
  summarize)
    summary_file=${2:?summary file is required}
    node --input-type=module - "$results_file" "$sizes_file" "$summary_file" <<'NODE'
import fs from 'node:fs';

const [, , resultsFile, sizesFile, summaryFile] = process.argv;

const percentile = (values, percentileValue) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

const rows = fs
  .readFileSync(resultsFile, 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map(line => {
    const [os, cache, versions, toolchains, implementation, iteration, elapsed] =
      line.split(',');
    return {
      os,
      cache,
      versions,
      toolchains,
      implementation,
      iteration,
      elapsed: Number(elapsed)
    };
  });

const groups = new Map();
for (const row of rows) {
  const key = [row.os, row.cache, row.versions, row.toolchains, row.implementation].join(',');
  const values = groups.get(key) ?? [];
  values.push(row.elapsed);
  groups.set(key, values);
}

const lines = [
  '## Maven configuration warm-path benchmark',
  '',
  '| OS | Cache | Versions | Toolchains | Implementation | Runs | Median (ms) | p95 (ms) |',
  '| --- | --- | --- | --- | --- | ---: | ---: | ---: |'
];

for (const [key, values] of [...groups.entries()].sort()) {
  const [os, cache, versions, toolchains, implementation] = key.split(',');
  lines.push(
    `| ${os} | ${cache} | ${versions} | ${toolchains} | ${implementation} | ${values.length} | ${percentile(values, 50)} | ${percentile(values, 95)} |`
  );
}

if (fs.existsSync(sizesFile)) {
  lines.push(
    '',
    '## setup entry/chunk sizes',
    '',
    '| Implementation | dist/setup/index.js bytes | dist/setup JS bytes | XML parser chunk location |',
    '| --- | ---: | ---: | --- |'
  );
  for (const line of fs.readFileSync(sizesFile, 'utf8').trim().split('\n')) {
    if (!line) continue;
    const [implementation, indexBytes, jsBytes, xmlParserChunks] = line.split(',');
    lines.push(
      `| ${implementation} | ${indexBytes} | ${jsBytes} | ${xmlParserChunks} |`
    );
  }
}

fs.appendFileSync(summaryFile, `${lines.join('\n')}\n`);
NODE
    ;;
  *)
    echo "Unsupported command: $command" >&2
    exit 1
    ;;
esac
