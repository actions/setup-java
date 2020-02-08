#!/bin/sh

if [ -z "$1" ]; then
  echo "Must supply java version argument"
  exit 1
fi

java_version="$(java -version)"
echo "Found java version: $java_version"
if [ -z "$(echo $java_version | grep --fixed-strings $1)" ]; then
  echo "Unexpected version"
  exit 1
fi

echo "Building sample proj"
proj_dir=__tests/sample-proj
mvn --file $proj_dir clean install dependency:copy-dependencies || exit 1

echo "Testing compiled app"
sample_output="$(java --class-path $proj_dir/target/HelloWorld-1.0-SNAPSHOT.jar:$proj_dir/target/dependency/json-20190722.jar com.helloworld.App)"
echo "Sample output: $sample_output"
if [ -z "$(echo $sample_output | grep --fixed-strings '{"Hello":"World!"}')" ]; then
  echo "Unexpected output"
  exit 1
fi
