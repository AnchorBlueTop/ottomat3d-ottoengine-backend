import { useMemo } from 'react';
import { Progress } from '@patternfly/react-core';

type Props = {
  job: any;
  showWhen?: 'printing-only' | 'printing-or-complete' | 'always';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showEta?: boolean;
};

function coercePercent(v: any | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) return undefined;
  const pct = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, pct));
}

function parseDetails(job: any) {
  try { return JSON.parse(job?.file_details_json || '{}') || {}; } catch { return {}; }
}

function formatSeconds(s?: number) {
  if (s === undefined || s === null || Number.isNaN(Number(s))) return undefined;
  const total = Math.max(0, Math.floor(Number(s)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getEtaFmt(job: any, pct?: number): string | undefined {
  if (pct === undefined || pct <= 0) return undefined;
  const d = parseDetails(job);
  const durSec = Number(job?.duration_seconds) || Number(d?.duration_seconds);
  if (!durSec) return undefined;
  const remaining = Math.round(durSec * ((100 - pct) / pct));
  return formatSeconds(remaining);
}

export default function PrintJobProgress({
  job,
  showWhen = 'printing-only',
  size = 'sm',
  className,
  showEta = true
}: Props) {
  const status = (job?.status ?? '').toUpperCase();

  const pct = useMemo(() => {
    const d = parseDetails(job);
    return (
      coercePercent(job?.progress_percent) ??
      coercePercent(job?.progress) ??
      coercePercent(d?.progress_percent) ??
      coercePercent(d?.progress)
    );
  }, [job]);

  const isPrinting = status === 'PRINTING';
  const isComplete = status === 'COMPLETE' || status === 'FINISHED';

  let shouldRender = false;
  if (showWhen === 'always') shouldRender = true;
  else if (showWhen === 'printing-only') shouldRender = isPrinting;
  else if (showWhen === 'printing-or-complete') shouldRender = isPrinting || isComplete;

  const fallback = pct ?? (isPrinting ? 0 : isComplete ? 100 : undefined);
  if (!shouldRender || fallback === undefined) return null;

  const etaFmt = showEta ? getEtaFmt(job, pct) : undefined;
  const percentText = `${Math.round(fallback)}%`;

  return (
    <div className={className}>
      <Progress value={fallback} aria-label='progress-bar' measureLocation="none" size={size} />
      <div className="pf-custom-progress-meta">
        <span className="pf-custom-progress-percent">{percentText}</span>
        {etaFmt ? (
          <span className="pf-custom-progress-eta">
            <span className="pf-custom-progress-eta-label">Time Remaining: </span>
            <span className="pf-custom-progress-eta-value">{etaFmt}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}