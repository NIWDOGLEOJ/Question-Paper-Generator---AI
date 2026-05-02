import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Printer, Download, ArrowLeft } from "lucide-react";
import * as pdfService from "../services/pdfService";
import { toast } from "sonner";

export function ViewPaper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<pdfService.Paper | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const found = pdfService.getPaper(id);
      if (found) { setPaper(found); }
      else { toast.error("Paper not found"); navigate("/"); }
      setIsLoading(false);
    }
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-10 h-10 fm-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-full py-8 px-4 sm:px-6 lg:px-8 print:p-0 fm-fadein">
      <div className="max-w-4xl mx-auto space-y-5 print:space-y-0">

        {/* ── Action bar ── */}
        <div className="fm-glass rounded-2xl px-5 py-3 flex items-center justify-between print:hidden">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm font-medium text-[#94B49C] hover:text-[#D5E2D6] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[#94B49C] transition-all hover:bg-[rgba(82,125,111,0.12)]"
              style={{ border: "1px solid rgba(148,180,156,0.2)" }}
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={() => { window.print(); toast.success("Use browser print dialog to save as PDF"); }}
              className="fm-btn-primary flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>

        {/* ── The paper ── */}
        <div
          className="rounded-2xl p-10 sm:p-16 print:shadow-none print:rounded-none print:p-0"
          style={{
            background: "#fff",
            color: "#1a1a1a",
            fontFamily: "'Georgia', serif",
          }}
        >
          {/* Header */}
          <div className="text-center border-b-2 border-gray-800 pb-6 mb-8">
            <h1 className="text-3xl font-bold uppercase tracking-widest">{paper!.subject}</h1>
            <h2 className="text-xl mt-2 font-medium text-gray-600">{paper!.title}</h2>
            <div className="flex justify-between mt-6 text-sm font-semibold text-gray-600">
              <span>Time Allowed: {paper!.duration}</span>
              <span>Total Marks: {paper!.totalMarks}</span>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-12">
            {paper!.sections.map((section, sIdx) => (
              <div key={sIdx}>
                <h3 className="text-lg font-bold underline decoration-gray-400 underline-offset-4">
                  {section.name}
                </h3>
                <p className="italic text-gray-500 mt-1 mb-4 text-sm">{section.instructions}</p>

                <ol className="list-decimal list-inside space-y-6">
                  {section.questions.map((q) => (
                    <li key={q.id} className="pl-2">
                      <div className="inline-block align-top w-[calc(100%-1.5rem)] ml-1">
                        <span className="font-medium text-gray-900 leading-relaxed">{q.text}</span>

                        {q.options && (
                          <div className="mt-3 ml-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-2 text-gray-700">
                                <span className="font-semibold">{String.fromCharCode(97 + oIdx)})</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {section.type === "Short Answer" && (
                          <div className="mt-6 mb-8 border-b border-dotted border-gray-300 w-full h-8" />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-400">
            *** End of Paper ***
          </div>
        </div>
      </div>
    </div>
  );
}
