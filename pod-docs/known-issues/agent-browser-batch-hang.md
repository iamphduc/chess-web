# agent-browser `batch` can hang on open + wait + eval

_Seen: 2026-10-16 · game-review L1_

**Symptom:** an `agent-browser batch` call that runs `open`, `wait` and `eval` together hit the 2-minute tool limit and returned nothing. It hung again after the session was closed and the call was retried.

**Workaround:** run `open` and `eval` as separate `agent-browser` commands. They returned at once. Keep `batch` for steps after the page is open, and give long calls a time limit.

**Cost when hit:** about 5 minutes.
