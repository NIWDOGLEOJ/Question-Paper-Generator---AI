import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  FileText, BookOpen, Wand2, Plus,
  Clock, BarChart2, Layers, Star,
  ChevronRight, Sparkles,
} from "lucide-react";
import * as pdfService from "../services/pdfService";
import * as sourceService from "../services/sourceService";

const PROFILE_KEY = "qpg_profile";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function Home() {
  const [papers,  setPapers]  = useState<pdfService.Paper[]>([]);
  const [sources, setSources] = useState<sourceService.SourceMaterial[]>([]);
  const [name,    setName]    = useState("there");

  useEffect(() => {
    setPapers(pdfService.getPapers());
    setSources(sourceService.getSources());
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
      if (p.name) setName(p.name.split(" ")[0]);
    } catch { /* use default */ }
  }, []);

  const recentPapers = [...papers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const totalQuestions = papers.reduce(
    (acc, p) => acc + p.sections.reduce((a, s) => a + s.questions.length, 0), 0
  );
  const totalMarks = papers.reduce((a, p) => a + p.totalMarks, 0);

  const stats = [
    { icon: FileText,  label: "Question Papers", value: papers.length,    href: "/papers"  },
    { icon: BookOpen,  label: "Source PDFs",      value: sources.length,   href: "/sources" },
    { icon: Layers,    label: "Questions Made",   value: totalQuestions,   href: "/papers"  },
    { icon: BarChart2, label: "Total Marks",      value: totalMarks,       href: "/papers"  },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 fm-fadein">

      {/* ── Greeting ── */}
      <div className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold tracking-widest text-[#527D6F] uppercase mb-1">
          Overview
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#D5E2D6]"
          style={{ fontFamily: "'Playfair Display', serif" }}>
          {greeting()}, {name}
        </h1>
        <p className="mt-1 text-sm text-[#94B49C]">
          Here's what's in your workspace.
        </p>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 sm:mb-10">
        {stats.map((s, i) => (
          <Link key={i} to={s.href}
            className="fm-glass p-5 rounded-xl group transition-all hover:bg-[rgba(82,125,111,0.12)]"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(82,125,111,0.18)" }}>
                <s.icon className="w-4 h-4 text-[#94B49C]" />
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#3a5560] group-hover:text-[#527D6F] transition-colors" />
            </div>
            <p className="text-2xl font-bold text-[#94B49C]">{s.value}</p>
            <p className="text-xs text-[#527D6F] mt-0.5 font-medium">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 sm:mb-10">
        <Link to="/new"
          className="fm-glass rounded-2xl px-5 sm:px-6 py-5 flex items-center gap-4 group
            transition-all hover:bg-[rgba(82,125,111,0.12)]">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 fm-float"
            style={{ background: "linear-gradient(135deg,#527D6F,#94B49C)" }}>
            <Plus className="w-5 h-5 text-[#2F3E46]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#D5E2D6] group-hover:text-white transition-colors truncate">
              Generate New Paper
            </p>
            <p className="text-xs text-[#527D6F] mt-0.5 truncate sm:overflow-visible sm:whitespace-normal">
              Upload a PDF and build an exam from scratch
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#3a5560] group-hover:text-[#527D6F] ml-auto transition-colors shrink-0" />
        </Link>

        <Link to="/sources"
          className="fm-glass rounded-2xl px-5 sm:px-6 py-5 flex items-center gap-4 group
            transition-all hover:bg-[rgba(82,125,111,0.12)]">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 fm-float"
            style={{ background: "rgba(82,125,111,0.2)", animationDelay: "0.2s" }}>
            <BookOpen className="w-5 h-5 text-[#94B49C]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#D5E2D6] group-hover:text-white transition-colors truncate">
              Browse Source Library
            </p>
            <p className="text-xs text-[#527D6F] mt-0.5 truncate sm:overflow-visible sm:whitespace-normal">
              {sources.length > 0
                ? `${sources.length} PDF${sources.length !== 1 ? "s" : ""} ready to use`
                : "Upload PDFs once, reuse them forever"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#3a5560] group-hover:text-[#527D6F] ml-auto transition-colors shrink-0" />
        </Link>
      </div>

      {/* ── Recent papers ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#527D6F]" />
            <h2 className="text-sm font-semibold text-[#94B49C] uppercase tracking-wide">
              Recent Papers
            </h2>
          </div>
          {papers.length > 3 && (
            <Link to="/papers"
              className="text-xs text-[#527D6F] hover:text-[#94B49C] transition-colors flex items-center gap-1">
              View all {papers.length} <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {recentPapers.length === 0 ? (
          <div className="fm-glass rounded-2xl p-8 sm:p-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 fm-float"
              style={{ background: "rgba(82,125,111,0.15)", border: "1px solid rgba(82,125,111,0.25)" }}>
              <Sparkles className="w-8 h-8 text-[#94B49C]" />
            </div>
            <h3 className="text-base font-bold text-[#D5E2D6] mb-1">No papers yet</h3>
            <p className="text-sm text-[#94B49C] mb-5 max-w-xs">
              Generate your first question paper from any PDF textbook in seconds.
            </p>
            <Link to="/new"
              className="fm-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold">
              <Plus className="w-4 h-4" /> Generate your first paper
            </Link>
          </div>
        ) : (
          <div className="fm-glass rounded-2xl overflow-hidden">
            <ul className="divide-y divide-[rgba(148,180,156,0.1)]">
              {recentPapers.map((paper, i) => (
                <li key={paper.id}
                  className="group hover:bg-[rgba(82,125,111,0.08)] transition-colors"
                  style={{ animationDelay: `${i * 50}ms` }}>
                  <Link to={`/paper/${paper.id}`} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "rgba(82,125,111,0.18)" }}>
                        <FileText className="w-4 h-4 text-[#94B49C]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#D5E2D6] truncate
                          group-hover:text-[#94B49C] transition-colors">
                          {paper.title}
                        </p>
                        <p className="text-xs text-[#527D6F] mt-0.5">
                          {paper.subject} · {new Date(paper.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 sm:ml-auto">
                      <span className="fm-badge">{paper.totalMarks} marks</span>
                      {(paper.tags?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                          text-[#527D6F] font-medium"
                          style={{ border: "1px solid rgba(148,180,156,0.15)", background: "rgba(82,125,111,0.08)" }}>
                          <Star className="w-2.5 h-2.5" />
                          {paper.tags![0]}
                          {paper.tags!.length > 1 && ` +${paper.tags!.length - 1}`}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-[#3a5560] group-hover:text-[#527D6F] transition-colors hidden sm:block" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {papers.length > 3 && (
              <Link to="/papers"
                className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium
                  text-[#527D6F] hover:text-[#94B49C] hover:bg-[rgba(82,125,111,0.06)]
                  transition-all border-t border-[rgba(148,180,156,0.1)]">
                <Wand2 className="w-3.5 h-3.5" />
                View all {papers.length} papers
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
