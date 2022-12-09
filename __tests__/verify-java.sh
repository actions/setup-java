#!/bin/sh

if [ -z "$1" ]; then
  echo "::error::Must supply java version argument"
  exit 1
fi

if [ -z "$2" ]; then
  echo "::error::Must supply java path argument"
  exit 1
fi

EXPECTED_JAVA_VERSION=$1
EXPECTED_PATH=$2

EXPECTED_JAVA_VERSION=$(echo $EXPECTED_JAVA_VERSION | cut -d'+' -f1)
if [[ $EXPECTED_JAVA_VERSION == 8 ]] || [[ $EXPECTED_JAVA_VERSION == 8.* ]]; then
  EXPECTED_JAVA_VERSION="1.${EXPECTED_JAVA_VERSION}"
fi
if [[ $EXPECTED_JAVA_VERSION == *-ea* ]]; then
  EXPECTED_JAVA_VERSION=$(echo $EXPECTED_JAVA_VERSION | cut -d'-' -f1 | cut -d'.' -f1)
fi

ACTUAL_JAVA_VERSION="$(java -version 2>&1)"
echo "Found java version: $ACTUAL_JAVA_VERSION"

GREP_RESULT=$(echo $ACTUAL_JAVA_VERSION | grep "^openjdk version \"$EXPECTED_JAVA_VERSION")
if [ -z "$GREP_RESULT" ]; then
  echo "::error::Unexpected version"
  echo "Expected version: $EXPECTED_JAVA_VERSION"
  exit 1
fi

if [ "$EXPECTED_PATH" != "$JAVA_HOME" ]; then
  echo "::error::Unexpected path"
  echo "Actual path: $JAVA_HOME"
  echo "Expected path: $EXPECTED_PATH"
  exit 1
fi
