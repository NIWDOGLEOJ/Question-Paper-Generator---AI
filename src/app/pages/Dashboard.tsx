import { useEffect, useState } from "react";
import { Link } from "react-router";
import { FileText, Plus, Calendar, Clock, BookOpen, Trash2, Sparkles } from "lucide-react";
import * as pdfService from "../services/pdfService";
import { toast } from "sonner";

export function Dashboard() {
  const [papers, setPapers] = useState<pdfService.Paper[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadPapers(); }, []);

  const loadPapers = () => {
    try {
      setPapers(pdfService.getPapers());
    } catch {
      toast.error("Failed to load papers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this paper?")) {
      pdfService.deletePaper(id);
      loadPapers();
      toast.success("Paper deleted");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="w-10 h-10 fm-spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 fm-fadein">
      {/* Header row */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#527D6F] uppercase mb-1">
            Your workspace
          </p>
          <h1 className="text-3xl font-bold text-[#D5E2D6]"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            Question Papers
          </h1>
          <p className="mt-1 text-sm text-[#94B49C]">
            Manage and preview your AI-generated papers.
          </p>
        </div>

        <Link
          to="/new"
          className="fm-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg"
        >
          <Plus className="w-4 h-4" />
          New Paper
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Papers", value: papers.length },
          { label: "Total Sections", value: papers.reduce((a, p) => a + p.sections.length, 0) },
          { label: "Total Marks", value: papers.reduce((a, p) => a + p.totalMarks, 0) },
        ].map((stat, i) => (
          <div
            key={i}
            className="fm-glass p-5 rounded-xl"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <p className="text-2xl font-bold text-[#94B49C]">{stat.value}</p>
            <p className="text-xs text-[#527D6F] mt-1 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Papers list */}
      {papers.length === 0 ? (
        <div className="fm-glass rounded-2xl p-16 flex flex-col items-center text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 fm-float"
            style={{ background: "rgba(82,125,111,0.15)", border: "1px solid rgba(82,125,111,0.25)" }}
          >
            <Sparkles className="w-9 h-9 text-[#94B49C]" />
          </div>
          <h3 className="text-lg font-bold text-[#D5E2D6] mb-2">No papers yet</h3>
          <p className="text-sm text-[#94B49C] mb-6 max-w-xs">
            Upload a textbook PDF and let the AI craft a complete question paper in seconds.
          </p>
          <Link
            to="/new"
            className="fm-btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Generate your first paper
          </Link>
        </div>
      ) : (
        <div className="fm-glass rounded-2xl overflow-hidden">
          <ul role="list" className="divide-y divide-[rgba(148,180,156,0.1)]">
            {papers.map((paper, i) => (
              <li
                key={paper.id}
                className="group transition-colors hover:bg-[rgba(82,125,111,0.08)]"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="px-6 py-4 flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(82,125,111,0.18)" }}
                  >
                    <FileText className="w-5 h-5 text-[#94B49C]" />
                  </div>

                  {/* Content */}
                  <Link to={`/paper/${paper.id}`} className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#D5E2D6] truncate group-hover:text-[#94B49C] transition-colors">
                      {paper.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#527D6F]">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> {paper.subject}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(paper.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {paper.duration}
                      </span>
                      <span className="text-[#94B49C] font-medium">{paper.totalMarks} marks</span>
                    </div>
                  </Link>

                  {/* Badge */}
                  <span className="fm-badge shrink-0">
                    {paper.sections.length} {paper.sections.length === 1 ? "section" : "sections"}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(paper.id)}
                    className="ml-2 p-2 rounded-lg text-[#527D6F] hover:text-[#c0504a] hover:bg-[rgba(192,80,74,0.1)] transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
