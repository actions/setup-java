if (!$args.Count -or !$args[0])
{
  throw "Must supply java version argument"
}

$java_version = & cmd.exe /c "java -version 2>&1" | Out-String
Write-Host "Found java version: $java_version"
if (!$java_version.Contains($args[0]))
{
  throw "Unexpected version"
}
