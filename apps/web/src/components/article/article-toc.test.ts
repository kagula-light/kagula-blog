import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArticleToc } from "./article-toc";

describe("ArticleToc", () => {
  it("renders nested heading links and a native mobile disclosure", () => {
    const html = renderToStaticMarkup(
      createElement(ArticleToc, {
        items: [
          { id: "setup", text: "准备", level: 2 },
          { id: "install", text: "安装", level: 3 },
        ],
      }),
    );

    expect(html).toContain('href="#setup"');
    expect(html).toContain('href="#install"');
    expect(html).toContain("article-toc-level-3");
    expect(html).toContain("<details");
  });
});
