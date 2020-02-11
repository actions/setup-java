#!/bin/sh

if [ -z "$1" ]; then
  echo "Must supply java version argument"
  exit 1
fi

java_version="$(java -version 2>&1)"
echo "Found java version: $java_version"
if [ -z "$(echo $java_version | grep --fixed-strings $1)" ]; then
  echo "Unexpected version"
  exit 1
fi
