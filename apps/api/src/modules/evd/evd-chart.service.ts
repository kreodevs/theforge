import { Injectable, Logger } from "@nestjs/common";
import type { EvdDesignTheme } from "./evd-design-system.js";
import { chartPalette } from "./evd-design-system.js";

export interface EvdChartData {
  chartType: string;
  title?: string;
  labels: string[];
  datasets: { label: string; values: number[]; color?: string }[];
}

@Injectable()
export class EvdChartService {
  private readonly logger = new Logger(EvdChartService.name);

  /**
   * Render chart data to SVG string using echarts SSR.
   * Falls back to a simple placeholder SVG if echarts is unavailable.
   */
  renderChartSVG(
    data: EvdChartData,
    theme: EvdDesignTheme,
    options?: { width?: number; height?: number },
  ): string {
    const width = options?.width ?? 1100;
    const height = options?.height ?? 500;

    try {
      // Dynamic import to handle environments where echarts may not be installed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const echarts = require("echarts");
      const chart = echarts.init(null, null, {
        renderer: "svg",
        ssr: true,
        width,
        height,
      });

      const config = this.buildEchartsConfig(data, theme);
      chart.setOption(config);
      const svgStr: string = chart.renderToSVGString();
      chart.dispose();
      return svgStr;
    } catch (err) {
      this.logger.warn(`echarts SSR unavailable, generating placeholder SVG: ${err}`);
      return this.placeholderSVG(data, width, height, theme);
    }
  }

  private buildEchartsConfig(data: EvdChartData, theme: EvdDesignTheme): Record<string, unknown> {
    const palette = chartPalette(theme);
    const chartType = data.chartType?.toLowerCase() ?? "bar";

    const isPie = chartType === "pie" || chartType === "doughnut";

    if (isPie) {
      return {
        backgroundColor: "transparent",
        title: data.title
          ? {
              text: data.title,
              left: "center",
              textStyle: { fontFamily: theme.typography.family, fontSize: 16, fontWeight: 700, color: theme.colors.text },
            }
          : undefined,
        color: data.datasets[0]?.values.map((_, i) => data.datasets[0]?.color ?? palette[i % palette.length]) ?? palette,
        series: [
          {
            type: chartType === "doughnut" ? "pie" : "pie",
            radius: chartType === "doughnut" ? ["40%", "70%"] : ["0%", "70%"],
            center: ["50%", "55%"],
            data: data.labels.map((label, i) => ({
              name: label,
              value: data.datasets[0]?.values[i] ?? 0,
            })),
            label: {
              show: true,
              formatter: "{b}: {d}%",
              fontFamily: theme.typography.family,
              fontSize: 12,
              color: theme.colors.text,
            },
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0,0,0,0.08)",
              borderRadius: 4,
            },
          },
        ],
      };
    }

    // Cartesian charts (bar, line, area, scatter)
    const seriesType = chartType === "area" ? "line" : chartType;

    return {
      backgroundColor: "transparent",
      title: data.title
        ? {
            text: data.title,
            left: "center",
            textStyle: { fontFamily: theme.typography.family, fontSize: 16, fontWeight: 700, color: theme.colors.text },
          }
        : undefined,
      tooltip: {
        trigger: "axis",
        backgroundColor: "#fff",
        borderColor: theme.colors.border,
        textStyle: { fontFamily: theme.typography.family, color: theme.colors.text, fontSize: 12 },
      },
      legend: data.datasets.length > 1
        ? {
            bottom: 0,
            textStyle: { fontFamily: theme.typography.family, fontSize: 11, color: theme.colors.textLight },
          }
        : undefined,
      grid: {
        left: 60,
        right: 30,
        top: data.title ? 60 : 30,
        bottom: data.datasets.length > 1 ? 50 : 30,
      },
      xAxis: {
        type: "category",
        data: data.labels,
        axisLine: { lineStyle: { color: theme.colors.border } },
        axisLabel: { fontFamily: theme.typography.family, fontSize: 11, color: theme.colors.textLight },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: theme.colors.gridLine, type: "dashed" } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontFamily: theme.typography.family, fontSize: 11, color: theme.colors.textLight },
      },
      color: palette,
      series: data.datasets.map((ds, i) => ({
        name: ds.label,
        type: seriesType === "scatter" ? "scatter" : seriesType,
        data: ds.values,
        smooth: seriesType === "line" ? 0.3 : undefined,
        symbolSize: seriesType === "scatter" ? 10 : undefined,
        areaStyle: chartType === "area"
          ? {
              color: {
                type: "linear",
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: ds.color ?? palette[i % palette.length] + "40" },
                  { offset: 1, color: ds.color ?? palette[i % palette.length] + "05" },
                ],
              },
            }
          : undefined,
        lineStyle: {
          width: 2.5,
          color: ds.color ?? palette[i % palette.length],
        },
        itemStyle: {
          color: ds.color ?? palette[i % palette.length],
          shadowBlur: 8,
          shadowColor: "rgba(0,0,0,0.1)",
        },
        barMaxWidth: 48,
        barGap: "20%",
      })),
    };
  }

  private placeholderSVG(data: EvdChartData, w: number, h: number, theme: EvdDesignTheme): string {
    const lines: string[] = [];
    const barW = Math.max(40, (w - 80) / Math.max(data.labels.length * 2, 1));
    const maxVal = Math.max(...(data.datasets[0]?.values ?? [1]), 1);

    data.labels.forEach((label, i) => {
      const val = data.datasets[0]?.values[i] ?? 0;
      const barH = (val / maxVal) * (h - 120);
      const x = 60 + i * barW * 2;
      const y = h - 40 - barH;
      const color = data.datasets[0]?.color ?? chartPalette(theme)[i % 6];
      lines.push(`<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="4"/>`);
      lines.push(`<text x="${x + barW / 2}" y="${h - 24}" text-anchor="middle" font-size="11" fill="${theme.colors.textLight}" font-family="${theme.typography.family}">${label}</text>`);
      lines.push(`<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="11" fill="${theme.colors.text}" font-family="${theme.typography.family}" font-weight="600">${val}</text>`);
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="transparent"/>
  ${data.title ? `<text x="${w / 2}" y="24" text-anchor="middle" font-size="16" font-weight="700" fill="${theme.colors.text}" font-family="${theme.typography.family}">${data.title}</text>` : ""}
  ${lines.join("\n  ")}
</svg>`;
  }
}
