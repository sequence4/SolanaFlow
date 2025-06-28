#!/bin/bash
if [[ "${NODE_ENV}" = "development" ]]; then
  rm -rf /usr/share/solanaflow/web/.next/cache
fi
exec "$@" 