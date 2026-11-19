# Security policy

English | 中文见下

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

- open this repository's **Security** tab and choose **Report a vulnerability** (GitHub private vulnerability
  reporting).

Include the version of DSH Universe (`@khglobal/dsh-universe`), the DSH version, and the steps to reproduce. We aim to
reply within five working days. Please give us a reasonable time to fix the problem before you disclose it.

## Supported versions

Only the latest published version of `@khglobal/dsh-universe` receives security fixes.

## Scope

DSH Universe runs inside DeepSeek Harness, reads session metadata on your own device and makes no network requests of
its own. Reports about data it should not read, data leaving the device, or anything that reaches a prompt are in
scope. Problems in DeepSeek Harness itself should go to the DSH project.

---

## 报告安全问题

请私下报告，不要开公开 issue：在本仓库的 **Security** 标签页选择 **Report a vulnerability**（GitHub 私密漏洞报告）。

请写明 DSH Universe 的版本、DSH 的版本和复现步骤。我们会尽量在五个工作日内回复；公开之前请给我们合理的修复时间。只有最新发布的
版本会得到安全修复。DeepSeek Harness 本身的问题请报告给 DSH 项目。
