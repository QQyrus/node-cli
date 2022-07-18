#!/bin/bash

release_version=$1

wget https://github.com/QQyrus/node-cli/releases/download/$release_version/qyrus-cli-linux
chmod 755 qyrus-cli-linux
echo "Copying the binary to /bin/"
mv qyrus-cli-linux /usr/local/bin/qyrus-cli && echo $? || echo $?
