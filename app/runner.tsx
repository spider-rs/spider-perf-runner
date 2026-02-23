"use client";

import { useState } from "react";
import SearchBar from "./searchbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface PerfMetrics {
  url: string;
  sizeKB: number;
  scripts: number;
  stylesheets: number;
  images: number;
  iframes: number;
  domElements: number;
  noLazyImages: number;
  score: number;
}

function analyzePerf(url: string, html: string): PerfMetrics {
  const sizeKB = Math.round(new Blob([html]).size / 1024 * 10) / 10;
  const scripts = (html.match(/<script[\s>]/gi) || []).length;
  const stylesheets = (html.match(/<link[^>]*rel=["']stylesheet["']/gi) || []).length;
  const images = (html.match(/<img[\s]/gi) || []).length;
  const iframes = (html.match(/<iframe[\s]/gi) || []).length;
  const domElements = (html.match(/<[a-z][^>]*>/gi) || []).length;
  const lazyImages = (html.match(/<img[^>]*loading=["']lazy["']/gi) || []).length;
  const noLazyImages = images - lazyImages;

  let score = 100;
  if (sizeKB > 500) score -= 20; else if (sizeKB > 200) score -= 10;
  if (scripts > 15) score -= 15; else if (scripts > 8) score -= 5;
  if (stylesheets > 5) score -= 10; else if (stylesheets > 3) score -= 5;
  if (domElements > 1500) score -= 15; else if (domElements > 800) score -= 5;
  if (noLazyImages > 5) score -= 10; else if (noLazyImages > 2) score -= 5;
  if (iframes > 3) score -= 10; else if (iframes > 0) score -= 3;

  return { url, sizeKB, scripts, stylesheets, images, iframes, domElements, noLazyImages, score: Math.max(0, score) };
}

type SortKey = "url" | "sizeKB" | "scripts" | "stylesheets" | "images" | "domElements" | "score";
type SortDir = "asc" | "desc";
type ScoreFilter = "all" | "good" | "ok" | "poor";
type ExportFormat = "json" | "csv" | "markdown";

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-500/10 border-green-500/20";
  if (score >= 50) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMetrics(metrics: PerfMetrics[], format: ExportFormat) {
  const ts = new Date().toISOString().slice(0, 10);
  const avg = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length) : 0;

  if (format === "json") {
    downloadBlob(JSON.stringify({ date: ts, averageScore: avg, pages: metrics }, null, 2), `perf-report-${ts}.json`, "application/json");
  } else if (format === "csv") {
    const rows = [["URL", "Size (KB)", "Scripts", "Stylesheets", "Images", "iframes", "DOM Elements", "Non-Lazy Images", "Score"]];
    for (const m of metrics) {
      rows.push([m.url, String(m.sizeKB), String(m.scripts), String(m.stylesheets), String(m.images), String(m.iframes), String(m.domElements), String(m.noLazyImages), String(m.score)]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(csv, `perf-report-${ts}.csv`, "text/csv");
  } else {
    let md = `# Performance Report\n\n**Date:** ${ts}\n**Pages:** ${metrics.length}\n**Average Score:** ${avg}/100\n\n`;
    md += "| URL | Size | Scripts | CSS | Images | DOM | Score |\n";
    md += "|-----|------|---------|-----|--------|-----|-------|\n";
    for (const m of metrics) {
      md += `| ${m.url} | ${m.sizeKB} KB | ${m.scripts} | ${m.stylesheets} | ${m.images} | ${m.domElements} | ${m.score} |\n`;
    }
    downloadBlob(md, `perf-report-${ts}.md`, "text/markdown");
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-block ml-0.5 text-[10px] ${active ? "text-[#3bde77]" : "text-muted-foreground/40"}`}>
      {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );
}

export default function Runner() {
  const [data, setData] = useState<any[] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState<ScoreFilter>("all");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "url" ? "asc" : "asc");
    }
  };

  const metrics = (data || []).filter((p) => p?.url && p?.content).map((p) => analyzePerf(p.url, p.content));
  const avgScore = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length) : 0;
  const avgSize = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.sizeKB, 0) / metrics.length * 10) / 10 : 0;
  const totalResources = metrics.reduce((s, m) => s + m.scripts + m.stylesheets + m.images, 0);
  const largest = metrics.length ? metrics.reduce((a, b) => a.sizeKB > b.sizeKB ? a : b) : null;
  const maxSize = metrics.length ? Math.max(...metrics.map((m) => m.sizeKB)) : 1;

  const goodCount = metrics.filter((m) => m.score >= 80).length;
  const okCount = metrics.filter((m) => m.score >= 50 && m.score < 80).length;
  const poorCount = metrics.filter((m) => m.score < 50).length;

  // Filter
  const filtered = filter === "all"
    ? metrics
    : filter === "good"
    ? metrics.filter((m) => m.score >= 80)
    : filter === "ok"
    ? metrics.filter((m) => m.score >= 50 && m.score < 80)
    : metrics.filter((m) => m.score < 50);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "url") cmp = a.url.localeCompare(b.url);
    else cmp = (a[sortKey] as number) - (b[sortKey] as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const filterCounts: Record<ScoreFilter, number> = { all: metrics.length, good: goodCount, ok: okCount, poor: poorCount };

  return (
    <div className="flex flex-col h-screen">
      <SearchBar setDataValues={setData} />
      <div className="flex-1 overflow-auto p-4 max-w-6xl mx-auto w-full">
        {metrics.length > 0 ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className={`border rounded-lg p-4 text-center ${scoreBg(avgScore)}`}>
                <p className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore}</p>
                <p className="text-xs text-muted-foreground mt-1">Avg Score</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{avgSize} KB</p>
                <p className="text-xs text-muted-foreground mt-1">Avg Page Size</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{totalResources}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Resources</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{largest?.sizeKB} KB</p>
                <p className="text-xs text-muted-foreground mt-1">Largest Page</p>
              </div>
            </div>

            {/* Size Distribution Chart */}
            <h3 className="font-bold mb-3">Page Size Distribution</h3>
            <div className="mb-6 space-y-1">
              {sorted.slice(0, 20).map((m) => (
                <div key={m.url} className="flex items-center gap-2 text-xs">
                  <span className="w-40 truncate text-muted-foreground">{(() => { try { return new URL(m.url).pathname; } catch { return m.url; } })()}</span>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                    <div className={`h-full rounded ${m.score >= 80 ? "bg-green-500" : m.score >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${(m.sizeKB / maxSize) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right">{m.sizeKB} KB</span>
                </div>
              ))}
            </div>

            {/* Download Controls */}
            <div className="flex items-center gap-2 mb-4">
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => exportMetrics(metrics, exportFormat)}>
                Download All ({metrics.length})
              </Button>
              {filter !== "all" && sorted.length > 0 && (
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => exportMetrics(sorted, exportFormat)}>
                  Download Filtered ({sorted.length})
                </Button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {([
                ["all", "All"],
                ["good", "Good (80+)"],
                ["ok", "OK (50-79)"],
                ["poor", "Poor (<50)"],
              ] as [ScoreFilter, string][]).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? "default" : "outline"}
                  onClick={() => setFilter(key)}
                  className="text-xs"
                >
                  {label} ({filterCounts[key]})
                </Button>
              ))}
            </div>

            {/* Table */}
            {sorted.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                No pages match the current filter.
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {([
                        ["url", "URL", "text-left"],
                        ["sizeKB", "Size", "text-center"],
                        ["scripts", "Scripts", "text-center"],
                        ["stylesheets", "CSS", "text-center"],
                        ["images", "Images", "text-center"],
                        ["domElements", "DOM", "text-center"],
                        ["score", "Score", "text-center"],
                      ] as [SortKey, string, string][]).map(([key, label, align]) => (
                        <th
                          key={key}
                          className={`p-3 font-medium cursor-pointer hover:text-foreground transition-colors select-none ${align}`}
                          onClick={() => toggleSort(key)}
                        >
                          {label}<SortIcon active={sortKey === key} dir={sortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((m) => (
                      <tr key={m.url} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 max-w-xs">
                          <a href={m.url} target="_blank" rel="noreferrer" className="font-mono text-xs hover:text-primary hover:underline truncate block" title={m.url}>
                            {m.url}
                          </a>
                        </td>
                        <td className="p-3 text-center text-xs">{m.sizeKB} KB</td>
                        <td className="p-3 text-center text-xs">{m.scripts}</td>
                        <td className="p-3 text-center text-xs">{m.stylesheets}</td>
                        <td className="p-3 text-center text-xs">{m.images}</td>
                        <td className="p-3 text-center text-xs">{m.domElements}</td>
                        <td className="p-3 text-center">
                          <Badge variant={m.score >= 80 ? "default" : m.score >= 50 ? "secondary" : "destructive"}>
                            {m.score}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <svg
              height={64}
              width={64}
              viewBox="0 0 36 34"
              xmlSpace="preserve"
              xmlns="http://www.w3.org/2000/svg"
              className="fill-[#3bde77] opacity-30"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.13883 7.06589V0.164429L13.0938 0.164429V6.175L14.5178 7.4346C15.577 6.68656 16.7337 6.27495 17.945 6.27495C19.1731 6.27495 20.3451 6.69807 21.4163 7.46593L22.8757 6.175V0.164429L26.8307 0.164429V7.06589V7.95679L26.1634 8.54706L24.0775 10.3922C24.3436 10.8108 24.5958 11.2563 24.8327 11.7262L26.0467 11.4215L28.6971 8.08749L31.793 10.5487L28.7257 14.407L28.3089 14.9313L27.6592 15.0944L26.2418 15.4502C26.3124 15.7082 26.3793 15.9701 26.4422 16.2355L28.653 16.6566L29.092 16.7402L29.4524 17.0045L35.3849 21.355L33.0461 24.5444L27.474 20.4581L27.0719 20.3816C27.1214 21.0613 27.147 21.7543 27.147 22.4577C27.147 22.5398 27.1466 22.6214 27.1459 22.7024L29.5889 23.7911L30.3219 24.1177L30.62 24.8629L33.6873 32.5312L30.0152 34L27.246 27.0769L26.7298 26.8469C25.5612 32.2432 22.0701 33.8808 17.945 33.8808C13.8382 33.8808 10.3598 32.2577 9.17593 26.9185L8.82034 27.0769L6.05109 34L2.37897 32.5312L5.44629 24.8629L5.74435 24.1177L6.47743 23.7911L8.74487 22.7806C8.74366 22.6739 8.74305 22.5663 8.74305 22.4577C8.74305 21.7616 8.76804 21.0758 8.81654 20.4028L8.52606 20.4581L2.95395 24.5444L0.615112 21.355L6.54761 17.0045L6.908 16.7402L7.34701 16.6566L9.44264 16.2575C9.50917 15.9756 9.5801 15.6978 9.65528 15.4242L8.34123 15.0944L7.69155 14.9313L7.27471 14.407L4.20739 10.5487L7.30328 8.08749L9.95376 11.4215L11.0697 11.7016C11.3115 11.2239 11.5692 10.7716 11.8412 10.3473L9.80612 8.54706L9.13883 7.95679V7.06589Z"
              ></path>
            </svg>
            <h2 className="text-xl font-semibold text-muted-foreground">
              Spider Perf Runner
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Enter a website URL above to crawl and analyze page performance.
              Spider will measure page size, resource counts, DOM complexity,
              and generate a performance score.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
