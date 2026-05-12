# CI and AI agents (Dagger)

`dagger/main.py` — Python Dagger module with three functions.

## Setup

Install the Dagger CLI, then initialise the module (generates `dagger.json` and `pyproject.toml`):

```bash
curl -fsSL https://dl.dagger.io/dagger/install.sh | sh
dagger init --sdk=python --source=dagger
```

Copy `.env.local.example` to `.env.local` and fill in your API key (already gitignored).

## Functions

### `solve` — coding agent (GitHub issue → draft PR)

Clones the repo inside a container, reads a GitHub issue, implements a fix, runs the tests, then opens a **draft PR** for human review. Draft = the agent can't accidentally ship broken code without a human clicking "ready for review".

```bash
dagger call solve \
  --issue-number=42 \
  --repo=owner/repo \
  --gh-token=env:GH_TOKEN
```

Required token scopes: `contents:write`, `pull-requests:write`, `issues:read`.

### `test` — CI

Runs `npm test` inside a fresh Node.js 22 Alpine container. No API key required.

```bash
dagger call test
```

### `review` — AI code review

Reads all `src/*.js` files and asks the configured LLM to review the renderer for bugs.

```bash
dagger call review
```

### `fix` — agentic code fix

Gives the LLM a Node.js container with the full project. The agent reads files, edits them, runs `npm test` to verify, and repeats until tests pass. Returns the modified `src/` directory.

```bash
dagger call fix --issue="describe the rendering bug here"
```

## Model configuration

Provider selection is fully env-var driven — the same `dagger call review` works with any of:

```bash
# Anthropic Claude (default model: claude-sonnet-4-5)
ANTHROPIC_API_KEY=sk-ant-... dagger call review

# OpenAI
OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o dagger call review

# Any OpenAI-compatible endpoint (LM Studio, Mistral AI, vLLM …)
OPENAI_BASE_URL=http://localhost:1234/v1/ OPENAI_API_KEY=x OPENAI_MODEL=mistral-small dagger call review

# Ollama (local, no API key — trailing slash on URL is mandatory)
OPENAI_BASE_URL=http://localhost:11434/v1/ OPENAI_MODEL=qwen2.5-coder:7b dagger call review
```

Put your preferred vars in `.env.local`; Dagger picks them up automatically.

## GitHub Actions

`.github/workflows/ci.yml` defines two jobs:

| Job | Trigger | Needs secret |
| --- | ------- | ----------- |
| `test` | every push + PR | none |
| `review` | PRs only | `ANTHROPIC_API_KEY` |

Add the secret under **Settings → Secrets and variables → Actions** in your GitHub repo. If the secret is absent the `review` job will fail; remove or comment out that job if you don't need it.

To use Ollama or another provider on CI, swap `ANTHROPIC_API_KEY` for the appropriate `OPENAI_*` vars in the workflow env block and update the secret names accordingly.
