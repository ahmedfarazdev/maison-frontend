// ============================================================
// JobSelector — Shared component for Production Stations
// Displays active jobs for the current mode and allows operators
// to select which job(s) they want to work on.
// ============================================================

import { useState } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { SectionCard, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Layers, CheckCircle2, ChevronDown, ChevronUp, User, Package,
  Clock, Boxes, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Job } from '@/types';

interface JobSelectorProps {
  mode?: 'one_time' | 'subscription'; // Optional — unified stations show all job types
  stationNumber: number;
  selectedJobIds: string[];
  onSelectionChange: (jobIds: string[]) => void;
}

export function JobSelector({ mode, stationNumber, selectedJobIds, onSelectionChange }: JobSelectorProps) {
  // If no mode specified, show all jobs (unified station mode)
  const [expanded, setExpanded] = useState(true);
  const { data: jobsRes } = useApiQuery(() => api.jobs.list(), []);
  const allJobs = (jobsRes || []) as Job[];

  // Filter to jobs of the current mode that are at or before this station
  const relevantJobs = allJobs.filter(j => {
    if (mode && j.source !== mode) return false;
    // Show jobs that are currently at this station or queued for it
    const stationStatus = j.station_statuses.find(s => s.station === stationNumber);
    if (!stationStatus) return false;
    return stationStatus.status === 'in_progress' || stationStatus.status === 'pending';
  });

  // Also show jobs that are generally in progress and haven't passed this station
  const activeJobs = allJobs.filter(j => {
    if (mode && j.source !== mode) return false;
    if (j.status === 'completed' || j.status === 'cancelled') return false;
    // If the station before this one is completed or this one is in progress
    const currentStation = j.station_statuses.find(s => s.status === 'in_progress');
    if (currentStation && currentStation.station === stationNumber) return true;
    // Also show pending jobs
    if (j.status === 'pending' && stationNumber === 2) return true;
    return false;
  });

  // Combine and deduplicate
  const jobsToShow = Array.from(new Map([...relevantJobs, ...activeJobs].map(j => [j.job_id, j])).values());

  const toggleJob = (jobId: string) => {
    if (selectedJobIds.includes(jobId)) {
      onSelectionChange(selectedJobIds.filter(id => id !== jobId));
    } else {
      onSelectionChange([...selectedJobIds, jobId]);
    }
  };

  const selectAll = () => {
    if (selectedJobIds.length === jobsToShow.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(jobsToShow.map(j => j.job_id));
    }
  };

  if (jobsToShow.length === 0) {
    return (
      <SectionCard
        title="Job Selection"
        subtitle="No active jobs at this station"
      >
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700">No jobs available</p>
            <p className="text-xs text-amber-600/80">
              Jobs need to be created and progress to this station before they appear here.
              Currently showing all batch items as a fallback.
            </p>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Active Jobs"
      subtitle="Select which job(s) to work on at this station"
      headerActions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={selectAll}>
            {selectedJobIds.length === jobsToShow.length ? 'Deselect All' : 'Select All'}
          </Button>
          <StatusBadge variant={selectedJobIds.length > 0 ? 'gold' : 'muted'}>
            {selectedJobIds.length} selected
          </StatusBadge>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      }
    >
      {expanded && (
        <div className="space-y-2">
          {jobsToShow.map(job => {
            const isSelected = selectedJobIds.includes(job.job_id);
            const currentStation = job.station_statuses.find(s => s.status === 'in_progress');
            const isAtThisStation = currentStation?.station === stationNumber;

            return (
              <button
                key={job.job_id}
                onClick={() => toggleJob(job.job_id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                  isSelected ? 'border-gold bg-gold/5 ring-1 ring-gold/20' : 'border-border hover:bg-muted/30',
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors',
                  isSelected ? 'bg-gold border-gold' : 'border-muted-foreground/30',
                )}>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-gold-foreground" />}
                </div>

                <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 text-gold" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold">{job.job_id}</span>
                    <StatusBadge variant={isAtThisStation ? 'success' : 'info'}>
                      {isAtThisStation ? 'Active' : 'In Progress'}
                    </StatusBadge>
                    {job.assigned_operator && (
                      <span className="flex items-center gap-1 text-[10px] text-violet-600 bg-violet-500/10 px-1.5 py-0.5 rounded-full">
                        <User className="w-2.5 h-2.5" />
                        {job.assigned_operator}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {job.order_ids.length} orders</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Boxes className="w-3 h-3" /> Batch</span>
                  </div>
                </div>

                {/* Progress indicator */}
                <div className="flex gap-0.5 shrink-0">
                  {job.station_statuses.slice(0, 4).map(s => (
                    <div
                      key={s.station}
                      className={cn(
                        'w-2 h-6 rounded-sm',
                        s.status === 'completed' ? 'bg-success' :
                        s.status === 'in_progress' ? 'bg-gold' : 'bg-muted',
                      )}
                      title={`S${s.station}: ${s.status}`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
