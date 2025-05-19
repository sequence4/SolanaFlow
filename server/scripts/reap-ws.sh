#!/bin/bash
psql_cmd="psql -U postgres -d solanaflow_db -At -c"

while read -r name; do
  docker stop "$name"    >/dev/null
  $psql_cmd "UPDATE warm_container_pool SET busy=false WHERE name='$name';"
done < <(
  $psql_cmd "SELECT name
               FROM warm_container_pool
              WHERE busy
                AND last_heartbeat < now() - interval '30 minutes';"
)
