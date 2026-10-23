#!/bin/bash
# Re-run the client gesture/keyboard test suite against web/index.html.
cd "$(dirname "$0")/.." && exec node test/client-tests.js
