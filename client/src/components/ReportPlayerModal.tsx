import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Flag, CheckCircle2 } from "lucide-react";

const REASONS: { value: string; label: string; desc: string }[] = [
  { value: "cheating",     label: "Cheating",       desc: "Using hacks, exploits, or unfair tools" },
  { value: "stalling",     label: "Stalling",        desc: "Deliberately wasting time or refusing to move" },
  { value: "toxic_chat",   label: "Toxic Chat",      desc: "Harassment, threats, or offensive language" },
  { value: "disconnecting",label: "Disconnecting",   desc: "Repeatedly leaving matches on purpose" },
  { value: "inappropriate",label: "Inappropriate",   desc: "Inappropriate profile or behavior" },
  { value: "other",        label: "Other",           desc: "Something else not listed above" },
];

interface ReportPlayerModalProps {
  open: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedName: string;
  matchId?: string;
}

export function ReportPlayerModal({ open, onClose, reportedUserId, reportedName, matchId }: ReportPlayerModalProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const reportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reports", { reportedUserId, matchId, reason, details }),
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit report. Please try again.", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setReason("");
    setDetails("");
    setSubmitted(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" style={{ background: "linear-gradient(145deg, #080c1a 0%, #0d1230 60%, #0f0a1e 100%)", border: "1px solid rgba(239,68,68,0.28)", boxShadow: "0 0 0 1px rgba(239,68,68,0.08), 0 40px 80px -20px rgba(0,0,0,0.9), 0 0 50px -20px rgba(239,68,68,0.12)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Flag className="w-5 h-5 text-red-400" />
            Report Player
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Reporting <span className="font-semibold text-white/70">{reportedName}</span>. False reports may result in account action.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Report Submitted</h3>
            <p className="text-white/50 text-sm">Our moderation team will review this report. Thank you for helping keep Jango.us fair.</p>
            <Button className="mt-5" onClick={handleClose} data-testid="button-close-report">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">Select reason</p>
              <div className="grid grid-cols-1 gap-2">
                {REASONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      reason === r.value
                        ? "border-red-500/60 bg-red-500/10"
                        : "border-white/10 bg-white/3 hover:border-white/20"
                    }`}
                    data-testid={`report-reason-${r.value}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white/90">{r.label}</span>
                      {reason === r.value && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Selected</Badge>}
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">Additional details (optional)</p>
              <Textarea
                placeholder="Describe what happened..."
                value={details}
                onChange={e => setDetails(e.target.value)}
                className="bg-white/5 border-white/15 text-white/90 placeholder:text-white/25 resize-none"
                rows={3}
                data-testid="report-details"
              />
            </div>

            <div className="flex items-center gap-1.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-200/70">Reports are reviewed by our team. Repeated false reports may result in account suspension.</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-white/15 text-white/60" onClick={handleClose}
                data-testid="button-cancel-report">
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!reason || reportMutation.isPending}
                onClick={() => reportMutation.mutate()}
                data-testid="button-submit-report"
              >
                <Flag className="w-4 h-4 mr-1.5" />
                {reportMutation.isPending ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
