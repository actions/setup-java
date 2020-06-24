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

if ($args.Count -lt 2 -or !$args[1])
{
  throw "Must supply java path argument"
}

if ($args[1] -ne $Env:JAVA_HOME)
{
  throw "Unexpected path"
}

if ($args.Count -lt 3 -or !$args[2])
{
  throw "Must supply java version argument"
}

if ($args[0] -ne $args[2])
{
  throw "Unexpected version"
}
