#!/bin/sh
# The tile build writes an absolute archive URL into each style. Point it at this server before
# serving, so the same tiles work under whatever PUBLIC_URL the stack runs on.
set -eu
mkdir -p /srv/tile-styles
for style in /tiles/styles/*.json; do
    [ -e "$style" ] || continue
    sed -E "s#pmtiles://[^\"]*/([^/\"]+\\.pmtiles)#pmtiles://${PUBLIC_URL}/tiles/\\1#" "$style" \
        > "/srv/tile-styles/$(basename "$style")"
done
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
