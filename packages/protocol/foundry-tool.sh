#!/bin/sh

echo "💫 preparing foundry..."
foundryup || { echo "🚨 issue running foundryup, ensure foundry is installed properly: https://github.com/foundry-rs/foundry"; exit 1; }
echo "✅ prepared foundry.\n"

echo "💫 installing foundry submodules..."
git submodule update --init --recursive
echo "✅ installed foundry submodules.\n"
