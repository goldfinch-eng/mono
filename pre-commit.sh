#!/bin/bash
git diff --cached --name-only | while read FILE; do
if [[ $(echo "$FILE" | grep -E "^.js$") ]]; then
    content=$(<"$FILE")
    if [[ $(echo "$content" | grep -E ".only") ]]; then
        echo -e "\e[1;31m\tCommit contains some text it should not.\e[0m" >&2
        exit 1
    fi
fi
done
