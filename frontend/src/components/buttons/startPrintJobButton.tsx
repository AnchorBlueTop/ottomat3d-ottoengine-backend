import { Button, Tooltip } from "@patternfly/react-core";
import { useContext, useState } from "react";
import { JobContext } from "../../App";
import { getAllPrintJobs, startPrintJob } from "../../ottoengine_API";

type Props = {
  jobId?: number;                       // If provided: starts this job
  variant?: "primary" | "secondary" | "plain" | "danger";
  className?: string;
  children?: React.ReactNode;
};

export default function StartPrintJobsButton({ jobId, variant = "primary", className, children }: Props) {
    const { selectedJobIDs, setIsJobQueueModalOpen, setPrintJob } = useContext(JobContext);
    const [loading, setLoading] = useState(false);
  
    // Simulate a 1-minute job by updating the JobContext every second
    const simulateOneMinuteJob = (existingJobId?: number) => {
      const id = existingJobId ?? Math.floor(Date.now() / 1000);
      const startedAt = Date.now();
      const totalSeconds = 60;
      const totalMs = totalSeconds * 1000;
  
      const makePartial = (progress: number, done: boolean) => {
        const status = done ? "COMPLETE" : "PRINTING"; // COMPLETE to match label mapping
        const details = {
          progress_percent: progress,
          duration_seconds: totalSeconds,
        };
        return {
          id,
          name: existingJobId ? `Simulated job ${id}` : `Dummy job ${new Date().toLocaleTimeString()}`,
          // Provide both shapes the UI can consume
          progress_percent: progress, // 0..100
          progress,                   // 0..100
          duration_seconds: totalSeconds,
          file_details_json: JSON.stringify(details),
          status,
          started_at: new Date(startedAt).toISOString(),
          finished_at: done ? new Date().toISOString() : undefined,
        };
      };
  
      // Ensure job exists in list at 0%
      setPrintJob((prev: any[] = []) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((j: any) => j.id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...makePartial(0, false) };
        } else {
          list.unshift(makePartial(0, false));
        }
        return list;
      });
  
      const handle = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
        const done = elapsed >= totalMs;
  
        setPrintJob((prev: any[] = []) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const idx = list.findIndex((j: any) => j.id === id);
          const update = makePartial(pct, done);
          if (idx >= 0) list[idx] = { ...list[idx], ...update };
          else list.unshift(update);
          return list;
        });
  
        if (done) {
          window.clearInterval(handle);
        }
      }, 1000);
    };
  
    // Per-row start
    if (jobId) {
      const onClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (loading) return;
  
        // Hold Alt/Option to simulate instead of calling the API
        if (e.altKey) {
          simulateOneMinuteJob(jobId);
          return;
        }
  
        try {
          setLoading(true);
          await startPrintJob(jobId);
          const refreshed = await getAllPrintJobs();
          setPrintJob(refreshed);
        } catch (e) {
          console.error("Failed to start print job", e);
        } finally {
          setLoading(false);
        }
      };
  
      return (
        <Tooltip content="Start job (Alt/Option-click to simulate 1-minute run)">
          <Button
            variant={variant}
            className={className}
            onClick={onClick}
            isLoading={loading}
            aria-label={`Start job ${jobId}`}
          >
            {children ?? "Start"}
          </Button>
        </Tooltip>
      );
    }
  
    // Toolbar fallback: open queue modal (existing behavior) + dev-only simulate button
    return (
      <>
        {selectedJobIDs.length ? (
          <Button
            id="start-print-job-button"
            className={`pf-custom-start-button ${className ?? ""}`}
            onClick={() => setIsJobQueueModalOpen(true)}
          >
            Start
          </Button>
        ) : null}
  
        {process.env.NODE_ENV !== "production" ? (
          <Button
            variant="secondary"
            className={className}
            onClick={() => simulateOneMinuteJob()}
          >
            Simulate 1‑min job
          </Button>
        ) : null}
      </>
    );
  }