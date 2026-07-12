import { Injectable, Logger } from "@nestjs/common";
import type { EvdDesignTheme } from "./evd-design-system.js";

@Injectable()
export class EvdDiagramService {
  private readonly logger = new Logger(EvdDiagramService.name);

  /** Render mermaid DSL to SVG using @mermaid-js/mermaid-cli. */
  async renderMermaidSVG(
    mermaidCode: string,
    theme: EvdDesignTheme,
  ): Promise<string> {
    try {
      const { run } = await import("@mermaid-js/mermaid-cli");
      const mermaidTheme = this.buildMermaidTheme(theme);

      const { writeFile, unlink, mkdtemp } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");

      const tmpDir = await mkdtemp(join(tmpdir(), "mermaid-"));
      const inputFile = join(tmpDir, "input.mmd");
      const outputFile = join(tmpDir, "output.svg");

      await writeFile(inputFile, mermaidCode, "utf-8");

      await run(inputFile, outputFile as `${string}.svg`, {
        parseMMDOptions: {
          mermaidConfig: {
            theme: "base",
            themeVariables: mermaidTheme,
            flowchart: {
              curve: "basis",
              padding: 20,
              nodeSpacing: 50,
              rankSpacing: 60,
              useMaxWidth: true,
              htmlLabels: true,
            },
          },
        },
        puppeteerConfig: {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        },
      });

      const svg = await import("node:fs/promises").then((fs) => fs.readFile(outputFile, "utf-8"));

      await unlink(inputFile).catch(() => {});
      await unlink(outputFile).catch(() => {});
      await import("node:fs/promises").then((fs) => fs.rmdir(tmpDir).catch(() => {}));

      return svg;
    } catch (err) {
      this.logger.warn(`mermaid-cli unavailable, generating fallback SVG: ${err}`);
      return this.fallbackSVG(mermaidCode, theme);
    }
  }

  private buildMermaidTheme(theme: EvdDesignTheme): Record<string, string> {
    return {
      primaryColor: theme.colors.brandPrimary + "20",
      primaryTextColor: theme.colors.text,
      primaryBorderColor: theme.colors.brandPrimary,
      lineColor: theme.colors.brandAccent,
      secondaryColor: theme.colors.brandSecondary + "20",
      secondaryTextColor: theme.colors.text,
      secondaryBorderColor: theme.colors.brandSecondary,
      tertiaryColor: theme.colors.brandAccent + "10",
      tertiaryTextColor: theme.colors.text,
      tertiaryBorderColor: theme.colors.brandAccent,
      fontFamily: theme.typography.family,
      fontSize: "13px",
      noteBkgColor: theme.colors.highlight + "15",
      noteTextColor: theme.colors.text,
      noteBorderColor: theme.colors.highlight,
      edgeLabelBackground: "#ffffff",
      clusterBkg: theme.colors.bgSubtle,
      clusterBorder: theme.colors.border,
      titleColor: theme.colors.text,
      edgeColor: theme.colors.brandAccent,
    };
  }

  private fallbackSVG(code: string, theme: EvdDesignTheme): string {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const lines = escaped.split("\n").slice(0, 20);
    const textElements = lines.map((line, i) =>
      `<text x="20" y="${30 + i * 18}" font-size="12" fill="${theme.colors.text}" font-family="monospace">${line}</text>`,
    ).join("\n  ");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.max(200, lines.length * 18 + 60)}" viewBox="0 0 800 ${Math.max(200, lines.length * 18 + 60)}">
  <rect width="100%" height="100%" fill="${theme.colors.bgSubtle}" rx="8"/>
  <text x="20" y="20" font-size="14" font-weight="700" fill="${theme.colors.text}" font-family="${theme.typography.family}">Diagrama (mermaid fallback)</text>
  ${textElements}
</svg>`;
  }
}
