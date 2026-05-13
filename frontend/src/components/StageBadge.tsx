import type { ModelVersion } from "../types";

const STAGE_STYLES: Record<ModelVersion["stage"], string> = {
  Production: "bg-emerald-900 text-emerald-300 border border-emerald-700",
  Staging:    "bg-yellow-900 text-yellow-300 border border-yellow-700",
  Archived:   "bg-gray-800 text-gray-400 border border-gray-700",
  None:       "bg-gray-800 text-gray-400 border border-gray-700",
};

export function StageBadge({ stage }: { stage: ModelVersion["stage"] }) {
  return (
    <span className={`badge ${STAGE_STYLES[stage] ?? STAGE_STYLES.None}`}>
      {stage}
    </span>
  );
}
