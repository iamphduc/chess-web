# chrome-devtools-axi `eval` breaks on double quotes or newlines on Windows

_Seen: 2026-10-20 · motion M1_

**Symptom:** an `npx -y chrome-devtools-axi eval "<script>"` call fails or runs a cut-down script when the script holds double quotes or newlines. Windows' command line splits or strips them on the way to npx.

**Workaround:** write each `eval` script on one line, wrap it in double quotes, and use only single quotes inside it, for example `eval "(() => document.querySelector('.player').getBoundingClientRect().height)()"`. For a long script, build it from short calls.

**Cost when hit:** about 10 minutes.
