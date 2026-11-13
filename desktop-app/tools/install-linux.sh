#!/usr/bin/env bash
# Installs the Linux build into your own folders and adds it to the
# applications menu; no administrator rights needed.
# Use: npm run package:linux, then bash tools/install-linux.sh
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) arch="$(uname -m)" ;;
esac
src="$here/dist/DesktopCat-linux-$arch"
dest="$HOME/.local/opt/desktop-cat"
marker=".desktop-cat-install"
data="${XDG_DATA_HOME:-$HOME/.local/share}"
apps="$data/applications"
icons="$data/icons/hicolor/256x256/apps"

if [ ! -x "$src/DesktopCat" ]; then
  echo "No build at $src: run npm run package:linux first"
  exit 1
fi

# Only a cat this script installed is replaced; anything else there stops it.
if [ -e "$dest" ] && [ ! -e "$dest/$marker" ]; then
  echo "$dest is there already, and this script did not put it there: stopping"
  exit 1
fi

# Files are not swapped under a running cat: quit it from its menu first. Only
# the program itself counts, at the start of a command line, with its path
# escaped, not a command that merely mentions it.
dest_pattern=$(printf '%s' "$dest" | sed 's/[][\\.*^$+?(){}|]/\\&/g')
if pgrep -f "^$dest_pattern/DesktopCat( |$)" >/dev/null; then
  echo "Desktop Cat is running: choose Quit in its menu, then install again"
  exit 1
fi

# Copied beside it first, then swapped in, so a copy that fails half way
# leaves no broken program behind; the copy is cleared away if it does.
mkdir -p "$(dirname "$dest")"
staging="$dest.new.$$"
trap 'rm -rf "$staging"' EXIT
cp -a "$src" "$staging"
touch "$staging/$marker"
if [ -e "$dest" ]; then
  mv "$dest" "$dest.old.$$"
fi
if ! mv "$staging" "$dest"; then
  # The old one goes back if the new one cannot go in.
  [ -e "$dest.old.$$" ] && mv "$dest.old.$$" "$dest"
  echo "Could not install; the version that was there is kept"
  exit 1
fi
rm -rf "$dest.old.$$"

mkdir -p "$apps" "$icons"
cp "$here/assets/icon.png" "$icons/desktop-cat.png"
# The menu entry comes from the same code as the login entry, so the flags and
# the quoting of the path are written in one place.
node -e '
  const { desktopEntry } = require(process.argv[1])
  process.stdout.write(desktopEntry({ execPath: process.argv[2], autostart: false }))
' "$here/src/platform/autostart-linux.js" "$dest/DesktopCat" >"$apps/desktop-cat.desktop"

echo "Installed in $dest"
echo "Find Desktop Cat in the applications menu; opened again while it runs, it brings a hidden cat back."
