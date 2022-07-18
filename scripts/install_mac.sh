#!/bin/bash

release_version=$1

wget https://github.com/QQyrus/node-cli/releases/download/$release_version/qyrus-cli-macos
chmod 755 qyrus-cli-macos
echo "Copying the binary to /usr/local/bin"
mv qyrus-cli-macos /usr/local/bin/qyrus-cli && echo $? || echo $?
echo "Copy Success, to path"