# pod docs

pod docs: 2

The files [pod](https://github.com/iamphduc/claude-pod) keeps for this project. Your own docs stay outside this folder.

```
pod-docs/
│  For you: you read these and decide
├── ideas/                  ideas saved for later (/pod:idea)
├── research/               web research reports
├── design-drafts/          look options to choose from
├── reports/                plan reports
│
│  Shared: you and the agents both read and write these
├── plans/                  plans; each keeps its resolved notes in a ## Queue log
├── decisions.md            your decisions, which agents must follow
├── handoff-queue.md        open notes between agents and you
│
│  For agents: agents keep these; skim them, fix what's wrong
├── codebase-structure.md   guide to your code, with the smoke recipe
├── features.md             how to prove each feature works
├── known-issues/           gotchas, one file each
└── sprints/                the current sprint, plus archive/ for finished ones
```

Read each sprint doc before `/pod:code` starts it. Keep the `pod docs:` line: pod reads it to know this folder's layout, and `/pod:init` updates it.
