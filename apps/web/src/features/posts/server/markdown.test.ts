import { describe, expect, it } from "vitest";

import { extractHeadingOutline, renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings, fenced code, and tables", () => {
    const html = renderMarkdown(`
# Content core

\`\`\`ts
const status = "DRAFT";
\`\`\`

| State | Public |
| --- | --- |
| Draft | No |
`);

    expect(html).toContain('<h1 id="content-core">Content core</h1>');
    expect(html).toContain('<code class="language-ts">');
    expect(html).toContain("<table>");
  });

  it("removes scripts, event handlers, and unsafe protocols", () => {
    const html = renderMarkdown(`
<script>alert("unsafe")</script>
<img src="https://assets.example/image.png" onerror="steal()">
[unsafe](javascript:alert(document.cookie))
`);

    expect(html).not.toMatch(/<script|onerror|href=["']javascript:/i);
    expect(html).toContain('<img src="https://assets.example/image.png" />');
  });

  it("adds isolation attributes to external links", () => {
    const html = renderMarkdown("[OpenAI](https://openai.com/research)");

    expect(html).toContain('href="https://openai.com/research"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("keeps relative links in the current browsing context", () => {
    const html = renderMarkdown("[归档](/archive)");

    expect(html).toContain('href="/archive"');
    expect(html).not.toContain('target="_blank"');
  });

  it("creates unique anchors for repeated multilingual headings", () => {
    const html = renderMarkdown("## 开始使用\n\n## 开始使用");

    expect(html).toContain('<h2 id="开始使用">开始使用</h2>');
    expect(html).toContain('<h2 id="开始使用-2">开始使用</h2>');
  });

  it("extracts a compact level-two and level-three outline", () => {
    const html = renderMarkdown("# Title\n\n## Setup\n\n### Install\n\n#### Detail");

    expect(extractHeadingOutline(html)).toEqual([
      { id: "setup", text: "Setup", level: 2 },
      { id: "install", text: "Install", level: 3 },
    ]);
  });
});
