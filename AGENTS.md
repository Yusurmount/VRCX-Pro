# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Version Control

- Unless explicitly requested, do not commit or revert changes.

## 6. 任务执行工作流

1. 开始每项任务前，必须先基于 master 新建独立 Worktree 和任务分支。
    - Worktree：/.worktrees/<task-name>
    - 分支：task/<task-name>

2. 所有修改只在该 Worktree 的独立分支中完成，不得直接影响 master 或其他 Worktree。

3. 修改完成后，先询问用户下一步操作：
   A. 一次性收尾：清理环境 + 合并 + 提交
   B. 仅合并：清理环境 + 合并

4. 确认合并时，先在当前 Worktree 中撰写或更新相关文档，再合并到本地 master。

5. 合并规则：
    - 默认不推送远程。
    - “仅合并”：只清理环境 + 合并，不自动提交 master；如需提交必须再次询问。
    - “一次性收尾”：清理环境 + 合并 + 提交；只提交本次任务实际改动。
    - 如使用 git merge --no-commit，必须明确告知 master 存在未提交改动。

6. 确认提交 master 后，更新相关 skill；只更新与本次任务相关的 skill。

7. 合并完成后，清理本次任务对应的 Worktree。
    - 仅清理本次任务创建的 Worktree。
    - 不得删除未跟踪文件。
    - 不得丢弃未提交改动。
    - 不得影响其他并行任务。

8. 禁止擅自推送或拉取。
9. 谨慎使用 force；任何 force 操作前必须说明原因并征得确认。
10. 全程考虑并行任务，避免干扰其他 Worktree。

完成后报告：

- 使用的 Worktree 和分支
- 修改了哪些文件
- 是否已更新相关文档
- 是否已合并到 master
- master 是否有未提交改动
- 是否已提交 master
- 是否已更新相关 skill
- 是否已清理 Worktree

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
