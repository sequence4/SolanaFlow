#!/bin/bash
rm -rf /usr/share/solanaflow/web/.next   # always start clean
exec "$@" 