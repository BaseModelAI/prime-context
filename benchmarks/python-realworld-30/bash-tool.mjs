import { spawn } from "node:child_process";

const MAX_CHARS = 60_000;
const KEEP_CHARS = 29_000;

function appendBounded(current, chunk) {
  const merged = current + chunk;
  if (merged.length <= MAX_CHARS) return { text: merged, truncated: false };
  return {
    text: merged.slice(0, KEEP_CHARS) + "\n\n[output truncated]\n\n" + merged.slice(-KEEP_CHARS),
    truncated: true,
  };
}

function boundLines(text) {
  const lines = text.split("\n");
  if (lines.length <= 2_000) return { text, truncated: false };
  return {
    text: [...lines.slice(0, 1_000), "[output truncated]", ...lines.slice(-1_000)].join("\n"),
    truncated: true,
  };
}

export default function benchmarkBashExtension(pi) {
  pi.registerTool({
    name: "bash",
    label: "Bash",
    description: "Run a Bash command in the isolated benchmark workspace. Use Python 3.12 standard library code for required transformations.",
    promptSnippet: "Run Bash commands in the isolated workspace",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Bash command to execute" },
        timeout: { type: "integer", minimum: 1, description: "Optional timeout in milliseconds" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const launcher = process.env.PRIME_CONTEXT_BENCHMARK_SHELL;
      if (!launcher) throw new Error("PRIME_CONTEXT_BENCHMARK_SHELL is not configured");
      return await new Promise((resolve, reject) => {
        const child = spawn(launcher, ["-c", params.command], {
          cwd: ctx.cwd,
          env: process.env,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let truncated = false;
        let timedOut = false;
        const append = (which, chunk) => {
          const result = appendBounded(which === "stdout" ? stdout : stderr, chunk.toString("utf8"));
          if (which === "stdout") stdout = result.text;
          else stderr = result.text;
          truncated ||= result.truncated;
        };
        child.stdout.on("data", (chunk) => append("stdout", chunk));
        child.stderr.on("data", (chunk) => append("stderr", chunk));
        const stop = () => {
          try { process.kill(-child.pid, "SIGTERM"); } catch {}
        };
        const timeoutTimer = params.timeout === undefined ? null : setTimeout(() => {
          timedOut = true;
          stop();
        }, params.timeout);
        timeoutTimer?.unref();
        const cleanup = () => {
          signal.removeEventListener("abort", stop);
          if (timeoutTimer !== null) clearTimeout(timeoutTimer);
        };
        signal.addEventListener("abort", stop, { once: true });
        child.on("error", (error) => {
          cleanup();
          reject(error);
        });
        child.on("close", (code, childSignal) => {
          cleanup();
          const combined = stdout + (stderr ? `${stdout ? "\n" : ""}[stderr]\n${stderr}` : "");
          const bounded = boundLines(combined);
          truncated ||= bounded.truncated;
          const withStatus = (status) => `${bounded.text}${bounded.text ? "\n\n" : ""}${status}`;
          if (timedOut) {
            reject(new Error(withStatus(`Command timed out after ${params.timeout} ms`)));
            return;
          }
          if (childSignal) {
            reject(new Error(withStatus(`Process terminated by ${childSignal}`)));
            return;
          }
          if (code !== 0 && code !== null) {
            reject(new Error(withStatus(`Command exited with code ${code}`)));
            return;
          }
          resolve({
            content: [{ type: "text", text: bounded.text }],
            details: { exitCode: code, signal: childSignal, truncated },
          });
        });
        if (signal.aborted) stop();
      });
    },
  });
}
