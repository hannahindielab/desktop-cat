#!/usr/bin/env bash
# Removes what install-linux.sh put in: the program, its menu entry, its icon,
# and its login entry. ~/.desktop-cat, which the Claude cat shares, stays.
set -euo pipefail

dest="$HOME/.local/opt/desktop-cat"
data="${XDG_DATA_HOME:-$HOME/.local/share}"
config="${XDG_CONFIG_HOME:-$HOME/.config}"

if [ -e "$dest" ] && [ ! -e "$dest/.desktop-cat-install" ]; then
  echo "install-linux.sh did not put $dest there: leaving it alone"
  exit 1
fi

# Only the program itself counts, as in install-linux.sh.
dest_pattern=$(printf '%s' "$dest" | sed 's/[][\\.*^$+?(){}|]/\\&/g')
if pgrep -f "^$dest_pattern/DesktopCat( |$)" >/dev/null; then
  echo "Desktop Cat is running: choose Quit in its menu, then uninstall"
  exit 1
fi

rm -rf "$dest"
rm -f "$data/applications/desktop-cat.desktop" "$data/icons/hicolor/256x256/apps/desktop-cat.png"
rm -f "$config/autostart/desktop-cat.desktop"
echo "Desktop Cat is removed (~/.desktop-cat is kept)"
