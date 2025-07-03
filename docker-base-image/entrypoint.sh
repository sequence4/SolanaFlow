#!/bin/bash
# keep the incremental cache – Turbo/SWC will invalidate stale chunks
# (wipe manually only when you hit a corrupted build)
exec "$@" 