import type { Run } from "../types";

const STATUS_STYLES: Record<Run["status"], string> = {
  RUNNING:   "bg-blue-900 text-blue-300 border border-blue-700",
  FINISHED:  "bg-emerald-900 text-emerald-300 border border-emerald-700",
  FAILED:    "bg-red-900 text-red-300 border border-red-700",
  KILLED:    "bg-orange-900 text-orange-300 border border-orange-700",
  SCHEDULED: "bg-purple-900 text-purple-300 border border-purple-700",
};

const STATUS_DOT: Record<Run["status"], string> = {
  RUNNING:   "bg-blue-400 animate-pulse",
  FINISHED:  "bg-emerald-400",
  FAILED:    "bg-red-400",
  KILLED:    "bg-orange-400",
  SCHEDULED: "bg-purple-400",
};

export function RunStatusBadge({ status }: { status: Run["status"] }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? "bg-gray-800 text-gray-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-gray-400"}`} />
      {status}
    </span>
  );
}
