import dagger
from dagger import dag, function, object_type


@object_type
class Minidoom:

    @function
    async def test(self) -> str:
        """Run the renderer gap tests inside a Node.js container."""
        return await (
            dag.container()
            .from_("node:22-alpine")
            .with_directory(
                "/app",
                dag.host().directory(
                    ".",
                    exclude=["node_modules", "dist", ".git", "dagger"],
                ),
            )
            .with_workdir("/app")
            .with_exec(["npm", "ci"])
            .with_exec(["npm", "test"])
            .stdout()
        )

    @function
    async def review(self) -> str:
        """AI code review of the renderer source.

        The LLM provider is selected automatically from environment variables —
        no code changes needed to switch models:

          Anthropic Claude   ANTHROPIC_API_KEY
          OpenAI             OPENAI_API_KEY  [+ OPENAI_MODEL]
          OpenAI-compatible  OPENAI_BASE_URL + OPENAI_API_KEY  [+ OPENAI_MODEL]
          Ollama (local)     OPENAI_BASE_URL=http://host:11434/v1/  +  OPENAI_MODEL=<model>
                             (note: trailing slash on the URL is mandatory for Ollama)
        """
        source = await (
            dag.container()
            .from_("alpine:3.20")
            .with_directory("/src", dag.host().directory("src"))
            .with_exec(["sh", "-c", "for f in /src/*.js; do echo \"=== $f ===\"; cat $f; done"])
            .stdout()
        )

        env = (
            dag.env()
            .with_string_input("source", source, "the raycaster source files")
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
    async def fix(self, issue: str) -> dagger.Directory:
        """Agentic fix: describe a rendering issue; get back modified src/ files.

        The agent runs inside a Node.js container so it can read source files,
        edit them, and re-run `npm test` to verify its changes before returning.
        """
        workspace = (
            dag.container()
            .from_("node:22-alpine")
            .with_directory(
                "/app",
                dag.host().directory(
                    ".",
                    exclude=["node_modules", "dist", ".git", "dagger"],
                ),
            )
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
