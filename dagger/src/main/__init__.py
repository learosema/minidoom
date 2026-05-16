import dagger
from dagger import dag, function, object_type


@object_type
class Minidoom:

    @function
    async def test(self, source: dagger.Directory) -> str:
        """Run the renderer gap tests inside a Node.js container."""
        return await (
            dag.container()
            .from_("node:22-alpine")
            .with_directory("/app", source)
            .with_workdir("/app")
            .with_exec(["npm", "ci"])
            .with_exec(["npm", "test"])
            .stdout()
        )

    @function
    async def review(self, source: dagger.Directory) -> str:
        """AI code review of the renderer source.

        The LLM provider is selected automatically from environment variables —
        no code changes needed to switch models:

          Anthropic Claude   ANTHROPIC_API_KEY
          OpenAI             OPENAI_API_KEY  [+ OPENAI_MODEL]
          OpenAI-compatible  OPENAI_BASE_URL + OPENAI_API_KEY  [+ OPENAI_MODEL]
          Ollama (local)     OPENAI_BASE_URL=http://host:11434/v1/  +  OPENAI_MODEL=<model>
                             (note: trailing slash on the URL is mandatory for Ollama)
        """
        source_text = await (
            dag.container()
            .from_("alpine:3.20")
            .with_directory("/src", source)
            .with_exec(["sh", "-c", "for f in /src/*.js; do echo \"=== $f ===\"; cat $f; done"])
            .stdout()
        )

        env = (
            dag.env()
            .with_string_input("source", source_text, "the raycaster source files")
            .with_string_output("review", "code review findings")
        )

        return await (
            dag.llm()
            .with_env(env)
            .with_prompt("""
                You are an expert graphics programmer reviewing a classic DDA raycaster.
                The source files are in $source.
                Focus on renderer.js: check floor/wall boundary maths, eye-height
                handling, horizon rounding, and any pixel gaps between rendered regions.
                Write a concise review with specific line references to $review.
            """)
            .env()
            .output("review")
            .as_string()
        )

    @function
    async def fix(self, source: dagger.Directory, issue: str) -> dagger.Directory:
        """Agentic fix: describe a rendering issue; get back modified src/ files.

        The agent runs inside a Node.js container so it can read source files,
        edit them, and re-run `npm test` to verify its changes before returning.
        """
        workspace = (
            dag.container()
            .from_("node:22-alpine")
            .with_directory("/app", source)
            .with_workdir("/app")
            .with_exec(["npm", "ci"])
        )

        env = (
            dag.env()
            .with_string_input("issue", issue, "the rendering issue to fix")
            .with_container_input("workspace", workspace, "Node.js project container")
            .with_container_output("fixed", "the container with the issue resolved")
        )

        result = (
            dag.llm()
            .with_env(env)
            .with_prompt("""
                You are an expert graphics programmer fixing a raycaster renderer.
                The issue is: $issue
                Use $workspace to explore files (e.g. cat src/renderer.js),
                make targeted edits, then run npm test to verify nothing is broken.
                Do not stop until all tests pass.
                Store the final container in $fixed.
            """)
        )

        return result.env().output("fixed").as_container().directory("/app/src")

    @function
    async def solve(
        self,
        issue_number: int,
        repo: str,
        gh_token: dagger.Secret,
    ) -> str:
        """Coding agent: read a GitHub issue, implement it, open a draft PR.

        Handles both bug fixes and new feature work — the agent reads the issue
        and decides what needs to be done. The repo is cloned fresh inside the
        container so it has a real git remote to push from.

        Usage:
            dagger call solve \\
              --issue-number=42 \\
              --repo=owner/repo \\
              --gh-token=env:GH_TOKEN

        Required token scopes: contents:write  pull-requests:write  issues:read
        """
        # Clone fresh so the container has a proper git remote it can push to.
        # gh honours GH_TOKEN for both clone auth and git-push credential lookup.
        workspace = (
            dag.container()
            .from_("node:22-alpine")
            .with_exec(["apk", "add", "--no-cache", "git", "github-cli", "bash"])
            .with_secret_variable("GH_TOKEN", gh_token)
            .with_env_variable("REPO", repo)
            .with_exec(["gh", "repo", "clone", repo, "/app", "--", "--depth=1"])
            .with_workdir("/app")
            # Let git push use the token via the credential helper gh installs.
            .with_exec(["git", "config", "user.email", "dagger-agent@users.noreply.github.com"])
            .with_exec(["git", "config", "user.name", "Dagger Agent"])
            .with_exec(["npm", "ci"])
        )

        env = (
            dag.env()
            .with_string_input("issue_number", str(issue_number), "GitHub issue number to implement")
            .with_string_input("repo", repo, "GitHub repository (owner/name)")
            .with_container_input("workspace", workspace, "cloned project with git, gh CLI, and Node.js")
            .with_string_output("result", "PR URL and a short summary of what was done")
        )

        return await (
            dag.llm()
            .with_env(env)
            .with_prompt("""
                You are an expert developer working on a DDA raycaster game engine.
                Your goal is to implement the work described in a GitHub issue and
                open a draft PR for human review.

                Work inside $workspace. Follow these steps in order:

                1. Read the issue and post a brief plan as a comment:
                   gh issue view $issue_number --repo $repo --json title,body \
                     -q '"## " + .title + "\n\n" + .body'
                   gh issue comment $issue_number --repo $repo \
                     --body "📋 Read the issue. Here's my plan: <one sentence>"

                2. Explore the relevant source files to understand the codebase:
                   (cat src/renderer.js, src/dungeon.js, src/player.js, etc.)
                   Also read the existing tests: cat test/render.test.js

                3. Create a branch:
                   git checkout -b ai/issue-$issue_number

                4. Implement the work. Keep changes focused — touch only what
                   the issue asks for and avoid unrelated refactoring.
                   For new features, add or extend tests in test/render.test.js
                   where it makes sense to do so.

                5. Run the full test suite and iterate until everything passes:
                   npm test
                   Post a comment when tests pass:
                   gh issue comment $issue_number --repo $repo --body "✅ Tests passing."

                6. Commit with a conventional-commits prefix that matches the work
                   (feat: for new features, fix: for bug fixes, docs: for docs, etc.):
                   git add -A
                   git commit -m "<prefix>: <short description> (closes #$issue_number)"

                7. Push:
                   git push origin ai/issue-$issue_number

                8. Open a DRAFT PR so a human reviews it before merge:
                   gh pr create \
                     --repo $repo \
                     --draft \
                     --title "<prefix>: <short description>" \
                     --body "Closes #$issue_number\n\n## What changed\n<bullet points>\n\n## Testing\n<how it was verified>"

                9. Post the PR URL as a comment on the issue and write it to $result:
                   gh issue comment $issue_number --repo $repo \
                     --body "🚀 Draft PR opened: <pr_url>\n\n<brief summary of changes>"

                Do not stop until the draft PR is open and all tests pass.
                If you cannot make the tests pass after several attempts, post a
                comment explaining what you tried and why it failed, then write
                the same explanation to $result.
            """)
            .env()
            .output("result")
            .as_string()
        )
