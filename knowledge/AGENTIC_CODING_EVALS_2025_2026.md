# Agentic Coding Evals (2025–2026): What Works (Evidence-Based)

**Goal:** capture *reusable*, low-complexity techniques for rapidly improving coding agents with measurable gains.

**Confidence policy:** This page only includes items directly supported by the sources linked below.

---

## 1) Minimal agent pattern: bash-only + linear history

**What it is:**
A stripped-down agent loop that relies primarily on a **bash-only tool interface** (run commands, inspect output, edit files) and keeps a **linear transcript/history**.

**Why it matters:**
This reduces hidden complexity and makes runs more reproducible/debuggable.

**Evidence / Sources:**
- SWE-bench site (variants incl. Bash Only / Verified): https://www.swebench.com/
- mini-SWE-agent repo (bash-only, linear history emphasis): https://github.com/SWE-agent/mini-swe-agent

---

## 2) Reliable evaluation: Verified subsets + harness quality

**What it is:**
Use a **human-filtered / validated subset** + an evaluation harness that reduces false negatives/positives from test irrelevance, underspecified issues, and environment setup failures.

**Evidence / Sources:**
- OpenAI: SWE-bench Verified rationale and failure modes: https://openai.com/index/introducing-swe-bench-verified/
- SWE-bench site overview of Verified + variants: https://www.swebench.com/

**Practical checklist (from Verified rationale):**
- Environment reproducibility (deterministic builds, pinned deps)
- Test validity (tests should reflect the stated issue; avoid overspecific hidden requirements)
- Issue spec quality (reduce ambiguity / missing constraints)
- Flake policy (rerun rules; isolate nondeterminism)
- Regression guardrails (PASS_TO_PASS should stay passing)

---

## 3) Goal-oriented evals: multi-round development

**What it is:**
Benchmarks that evaluate agents as iterative developers optimizing outcomes across rounds (not just one-shot ticket fixes).

**Evidence / Sources:**
- CodeClash website: https://codeclash.ai/
- CodeClash paper: https://arxiv.org/abs/2511.00839
- CodeClash repo: https://github.com/codeclash-ai/codeclash

**Suggested metrics (from the goal/tournament framing):**
- Relative win rate / ELO-style performance
- Improvement across rounds
- Codebase health/entropy over time

---

## 4) Follow-ups (not yet sourced here)

- Terminal/CLI tool-use benchmarks (e.g., Terminal-Bench): **needs primary sources** before we promote to “verified” knowledge.

