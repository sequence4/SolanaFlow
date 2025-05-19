#!/bin/sh
set -e
while true; do
  curl -s -X POST "http://host.docker.internal:4000/internal/heartbeat/$WORKSPACE_ID" --connect-timeout 1 --max-time 2 || true
  sleep 15
done &
exec "$@"