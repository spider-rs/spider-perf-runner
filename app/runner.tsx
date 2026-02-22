"use client";

import { useState } from "react";
import SearchBar from "./searchbar";
import { Badge } from "@/components/ui/badge";

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

export default function Runner() {
  const [data, setData] = useState<any[] | null>(null);

  const metrics = (data || []).filter((p) => p?.url && p?.content).map((p) => analyzePerf(p.url, p.content));
  const avgScore = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length) : 0;
  const avgSize = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.sizeKB, 0) / metrics.length * 10) / 10 : 0;
  const totalResources = metrics.reduce((s, m) => s + m.scripts + m.stylesheets + m.images, 0);
  const largest = metrics.length ? metrics.reduce((a, b) => a.sizeKB > b.sizeKB ? a : b) : null;
  const maxSize = metrics.length ? Math.max(...metrics.map((m) => m.sizeKB)) : 1;

  return (
    <div className="flex flex-col h-screen">
      <SearchBar setDataValues={setData} />
      <div className="flex-1 overflow-auto p-4">
        {metrics.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="border rounded-lg p-4 text-center">
                <p className={`text-2xl font-bold ${avgScore >= 80 ? "text-green-500" : avgScore >= 50 ? "text-yellow-500" : "text-red-500"}`}>{avgScore}</p>
                <p className="text-sm text-muted-foreground">Avg Score</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{avgSize} KB</p>
                <p className="text-sm text-muted-foreground">Avg Page Size</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{totalResources}</p>
                <p className="text-sm text-muted-foreground">Total Resources</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{largest?.sizeKB} KB</p>
                <p className="text-sm text-muted-foreground">Largest Page</p>
              </div>
            </div>
            <h3 className="font-bold mb-3">Page Size Distribution</h3>
            <div className="mb-6 space-y-1">
              {metrics.slice(0, 20).map((m) => (
                <div key={m.url} className="flex items-center gap-2 text-xs">
                  <span className="w-40 truncate text-muted-foreground">{new URL(m.url).pathname}</span>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                    <div className={`h-full rounded ${m.score >= 80 ? "bg-green-500" : m.score >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${(m.sizeKB / maxSize) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right">{m.sizeKB} KB</span>
                </div>
              ))}
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr><th className="text-left p-3">URL</th><th className="p-3">Size</th><th className="p-3">Scripts</th><th className="p-3">CSS</th><th className="p-3">Images</th><th className="p-3">DOM</th><th className="p-3">Score</th></tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.url} className="border-t">
                      <td className="p-3 truncate max-w-xs">{m.url}</td>
                      <td className="p-3 text-center">{m.sizeKB} KB</td>
                      <td className="p-3 text-center">{m.scripts}</td>
                      <td className="p-3 text-center">{m.stylesheets}</td>
                      <td className="p-3 text-center">{m.images}</td>
                      <td className="p-3 text-center">{m.domElements}</td>
                      <td className="p-3 text-center"><Badge variant={m.score >= 80 ? "default" : m.score >= 50 ? "secondary" : "destructive"}>{m.score}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!data && <div className="flex items-center justify-center h-full text-muted-foreground">Enter a URL to analyze performance</div>}
      </div>
    </div>
  );
}
