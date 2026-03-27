// ============================================================
// Setup Guide — Pod-Based Operations & Job Management
// Explains the pod framework, queue system, job lifecycle, and fulfillment pipeline
// ============================================================

import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Factory, Users, ArrowRight, ArrowDown, CheckCircle2, Lightbulb,
  ChevronDown, ChevronUp, BookOpen, Workflow, Layers, Clock,
  Package, Truck, Tag, BarChart2, Printer, Shield, Zap,
  Target, GitBranch, ListChecks, Boxes, ScanBarcode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

/* ─── Module Definitions ─── */
interface ModuleInfo {
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  howItWorks: string[];
  keyFeatures: string[];
  tips: string[];
  link: string;
}

const modules: ModuleInfo[] = [
  {
    name: 'Master Pods & Jobs',
    icon: BarChart2,
    color: 'border-violet-500 bg-violet-500/10 text-violet-500',
    description: 'The admin command center for all pods and jobs. Create, manage, and monitor pods. View the interactive Gantt chart for weekly planning. Track analytics across all production and fulfillment operations.',
    howItWorks: [
      'Create pods with a nickname, type (Production or Fulfillment), and assign team members',
      'Each pod can have a Pod Leader, Senior Members, and Junior Members',
      'The Kanban board shows all active jobs across pods in Queued / In Progress / Paused columns',
      'Analytics tab shows job throughput, pod utilization, and an interactive 7-day Gantt chart',
      'Gantt chart is filterable by pod, job type, and time range — drag to adjust timelines',
    ],
    keyFeatures: [
      'Pod CRUD — create, edit, deactivate pods with member management',
      'Interactive Kanban board with drag-and-drop job management',
      '7-day interactive Gantt chart for timeline visualization',
      'Job type analytics: Subscription, First Subscription, On-Demand, RTS Production',
      'Pod performance metrics: throughput, utilization, average completion time',
    ],
    tips: [
      'Production pods handle the full pipeline: Picking → Labeling → Decanting → QC & Assembly',
      'Fulfillment pods handle shipping: Preparing → Assembly → Labels → Ready for Pickup → Shipped',
      'Use the Gantt chart for weekly planning meetings to visualize workload distribution',
      'Each pod can run up to 3 active jobs simultaneously in production, or sequential in fulfillment',
    ],
    link: '/ops/master-dashboard',
  },
  {
    name: 'Pod Dashboard',
    icon: Factory,
    color: 'border-blue-500 bg-blue-500/10 text-blue-500',
    description: 'The operator\'s workstation. Each pod has its own dashboard instance showing active jobs, pipeline progress, and the "Pick Next Job" button to pull work from the queue.',
    howItWorks: [
      'Select your pod from the pod selector dropdown at the top',
      'Click "Pick Next Job" to pull the highest-priority job from the Production or Fulfillment Queue',
      'Each production pod can run up to 3 active jobs simultaneously — each with its own pipeline',
      'The pipeline stages depend on the job type: Subscription, On-Demand, or RTS Production',
      'Navigate to individual station ops (Picking, Labeling, Decanting, QC, Shipping) from the dashboard',
    ],
    keyFeatures: [
      'Multi-pipeline support — up to 3 active jobs per production pod',
      'Pick Next Job — pulls highest-priority job from queue automatically',
      'Pipeline visualization — see each job\'s progress through stages',
      'Quick navigation to station operations (Picking, Labeling, Decanting, QC & Assembly)',
      'Job details panel — view order count, perfumes, timeline, and priority',
    ],
    tips: [
      'Production pods: up to 3 active jobs, each with its own pipeline tracker',
      'Fulfillment pods: one active job at a time, can pick next after "Ready for Pickup" stage',
      'The pipeline auto-adjusts based on job tag — subscription orders have different stages than RTS',
      'Use the station ops links to navigate directly to the relevant operation for the current stage',
    ],
    link: '/ops/pod-dashboard',
  },
  {
    name: 'Production Queue',
    icon: Layers,
    color: 'border-amber-500 bg-amber-500/10 text-amber-500',
    description: 'The central queue where all production jobs wait to be picked by pods. Jobs are prioritized by urgency tags (VIP, Urgent, High, Medium, Low) and can be viewed in Kanban or List mode.',
    howItWorks: [
      'Jobs enter the queue after being created via Order Grouping → Job Allocation',
      'Each job has a priority tag: VIP, Urgent, High, Medium, or Low',
      'Priority tags can be edited directly from the queue — click the tag to change it',
      'Pods pull jobs from this queue via the "Pick Next Job" button on their Pod Dashboard',
      'The Kanban view shows jobs organized by status: Queued → In Progress → Completed',
    ],
    keyFeatures: [
      'Kanban + List dual view modes',
      'Inline priority tag editing (VIP / Urgent / High / Medium / Low)',
      'Job cards show: job code, order count, perfume count, assigned pod, timeline',
      'Filter by priority, job type, and date range',
      'Real-time status updates as pods progress through jobs',
    ],
    tips: [
      'VIP and Urgent jobs appear at the top of the queue for immediate pickup',
      'Use the Kanban view for a visual overview, List view for detailed filtering',
      'Priority tags are editable at any time — escalate jobs as needed',
      'The queue auto-refreshes — no need to manually reload',
    ],
    link: '/ops/production-queue',
  },
  {
    name: 'Fulfillment Queue',
    icon: Truck,
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
    description: 'The shipping pipeline queue. Completed production jobs flow here for fulfillment pods to handle the shipping process: Preparing → Assembly → Labels Generated → Ready for Pickup → Shipped.',
    howItWorks: [
      'Jobs enter after production is complete — they flow from Production Queue → Fulfillment Queue',
      'Fulfillment pods pick jobs and process them through the shipping pipeline',
      'Pipeline stages: Preparing for Shipping → Assembly → Labels Generated → Ready for Pickup → Shipped',
      'Once a job reaches "Ready for Pickup", the fulfillment pod can pick the next job',
      'The "Shipped" status is the final stage — the job is complete',
    ],
    keyFeatures: [
      'Fragmented fulfillment pipeline with 5 distinct stages',
      'Kanban + List dual view modes with priority tags',
      'Pipeline progress visualization per job',
      'Carrier and AWB tracking integration',
      'Automatic status progression as stages complete',
    ],
    tips: [
      'Fulfillment pods can pick a new job once the current one reaches "Ready for Pickup"',
      'This allows parallel processing — one job being picked up while another is being prepared',
      'Labels Generated stage triggers the Print Queue for shipping label printing',
      'Use the pipeline view to see bottlenecks in the fulfillment process',
    ],
    link: '/ops/fulfillment-queue',
  },
  {
    name: 'Order Grouping & Job Allocation',
    icon: GitBranch,
    color: 'border-pink-500 bg-pink-500/10 text-pink-500',
    description: 'The job creation flow. Group orders by type, create jobs with tags, and allocate them to production and fulfillment pods. This is where work enters the pod system.',
    howItWorks: [
      'Step 1: Group orders — select orders from the order pool and group them by type',
      'Step 2: Tag the group — Subscription, First Subscription, On-Demand, or RTS Production',
      'Step 3: Create the job — the grouped orders become a fulfillment job with a job code',
      'Step 4: Allocate to pods — select a Production Pod and (optionally) a Fulfillment Pod',
      'Step 5: Set timeline — define the expected completion date based on job type',
    ],
    keyFeatures: [
      'Smart order grouping by type, date, and customer segment',
      'Job tagging: Subscription, First Subscription, On-Demand, RTS Production',
      'Dual pod allocation — assign both Production and Fulfillment pods',
      'Timeline setting with configurable durations per job type',
      'Manual override option for direct pod assignment',
    ],
    tips: [
      'Subscription orders typically get 5-7 day timelines',
      'On-Demand orders get 1-2 day timelines with higher priority',
      'RTS Production (Ready-to-Ship) only needs a Production Pod — no Fulfillment Pod needed',
      'The allocation is a manual override — normally pods pull from the queue automatically',
      'Tags auto-propagate from order type but can be manually adjusted',
    ],
    link: '/ops/job-allocation',
  },
  {
    name: 'Job Ledger',
    icon: ListChecks,
    color: 'border-slate-500 bg-slate-500/10 text-slate-500',
    description: 'The historical record of all jobs. Every job created, completed, or cancelled is logged here with full audit trail including pod assignment, timeline, and status changes.',
    howItWorks: [
      'Every job creation, status change, and completion is automatically logged',
      'Filter by date range, job type, pod, status, and priority',
      'Export to CSV for external reporting and analysis',
      'Click any job to see the full timeline of status changes',
    ],
    keyFeatures: [
      'Complete job history with audit trail',
      'Advanced filtering and search',
      'CSV export for external reporting',
      'Job timeline visualization',
      'Pod performance tracking per job',
    ],
    tips: [
      'Use the Job Ledger for weekly performance reviews',
      'Export data monthly for management reporting',
      'Filter by pod to see individual pod performance over time',
      'The ledger is append-only — records cannot be deleted for audit compliance',
    ],
    link: '/ops/job-ledger',
  },
];

/* ─── Station Operations ─── */
const stationOps = [
  { name: 'Picking Ops', desc: 'Pull perfume bottles and materials from inventory based on the job\'s BOM requirements', icon: ScanBarcode, color: 'text-blue-500' },
  { name: 'Labeling Ops', desc: 'Generate and apply labels to vials, boxes, and shipping materials', icon: Tag, color: 'text-emerald-500' },
  { name: 'Decanting Ops', desc: 'Fill vials from opened bottles according to the job\'s perfume list and quantities', icon: Boxes, color: 'text-amber-500' },
  { name: 'QC & Assembly Ops', desc: 'Quality check each vial, assemble the final product packages, and segregate by order', icon: Shield, color: 'text-violet-500' },
  { name: 'Shipping & Dispatch', desc: 'Generate AWBs, print shipping labels, pack for courier, and mark as shipped', icon: Truck, color: 'text-pink-500' },
];

/* ─── Role Definitions ─── */
const roles = [
  { name: 'Pod Leader', desc: 'Manages the pod, assigns tasks, oversees quality. Can pick jobs and manage pod members.', badge: 'bg-violet-500/10 text-violet-500 border-violet-500/30' },
  { name: 'Pod Senior', desc: 'Experienced operator who can work all stations. Can pick jobs and train juniors.', badge: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  { name: 'Pod Junior', desc: 'Trainee operator assigned to specific stations. Works under senior guidance.', badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
];

export default function OperationsGuide() {
  const [, setLocation] = useLocation();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Operations & Job Management Guide"
        subtitle="Pod-based queue fulfillment architecture — how pods, jobs, queues, and pipelines work together"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Setup Guides' },
          { label: 'Operations' },
        ]}
      />

      <div className="p-6 space-y-8">
        {/* Overview */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <Factory className="w-7 h-7 text-gold" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Pod-Based Queue Fulfillment Architecture</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Maison Em's operations follow an <strong>Amazon-style fulfillment center model</strong>. Work is organized into
                  <strong> Pods</strong> (self-contained teams), <strong>Jobs</strong> (batches of orders), and <strong>Queues</strong> (prioritized
                  work pools). Pods pull jobs from queues, process them through pipelines, and deliver completed orders.
                  This architecture enables parallel processing, clear accountability, and scalable operations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* End-to-End Flow */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="w-5 h-5 text-info" />
              End-to-End Job Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-4">
              {/* Row 1: Order Grouping */}
              <div className="border border-pink-500/30 bg-pink-500/10 rounded-xl p-4 text-center min-w-[220px]">
                <GitBranch className="w-8 h-8 mx-auto mb-1 text-pink-500" />
                <p className="font-semibold text-sm">Order Grouping</p>
                <p className="text-[10px] text-muted-foreground">Group orders → Create job → Tag & allocate</p>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />

              {/* Row 2: Queues */}
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl p-4 text-center min-w-[200px]">
                  <Layers className="w-7 h-7 mx-auto mb-1 text-amber-500" />
                  <p className="font-semibold text-sm">Production Queue</p>
                  <p className="text-[10px] text-muted-foreground">Prioritized by VIP → Urgent → High → Medium → Low</p>
                </div>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />

              {/* Row 3: Production Pod */}
              <div className="border border-blue-500/30 bg-blue-500/10 rounded-xl p-4 text-center w-full max-w-lg">
                <Factory className="w-8 h-8 mx-auto mb-1 text-blue-500" />
                <p className="font-semibold text-sm mb-2">Production Pod (up to 3 active jobs)</p>
                <div className="flex flex-wrap justify-center gap-1">
                  {['Picking', 'Labeling', 'Decanting', 'QC & Assembly'].map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">{s}</Badge>
                  ))}
                </div>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />

              {/* Row 4: Fulfillment Queue */}
              <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-4 text-center min-w-[200px]">
                <Truck className="w-7 h-7 mx-auto mb-1 text-emerald-500" />
                <p className="font-semibold text-sm">Fulfillment Queue</p>
                <p className="text-[10px] text-muted-foreground">Completed production → ready for shipping</p>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />

              {/* Row 5: Fulfillment Pod */}
              <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-4 text-center w-full max-w-lg">
                <Package className="w-8 h-8 mx-auto mb-1 text-emerald-500" />
                <p className="font-semibold text-sm mb-2">Fulfillment Pod</p>
                <div className="flex flex-wrap justify-center gap-1">
                  {['Preparing', 'Assembly', 'Labels Generated', 'Ready for Pickup', 'Shipped'].map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">{s}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Types */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="w-5 h-5 text-info" />
              Job Types & Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { tag: 'Subscription', desc: 'Recurring monthly subscription cycle orders. Timeline: 5-7 days. Requires both Production + Fulfillment pods.', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
                { tag: 'First Subscription', desc: 'First-time subscriber orders with welcome kit. Timeline: 5-7 days. Requires both Production + Fulfillment pods.', color: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
                { tag: 'On-Demand', desc: 'One-time à la carte orders. Timeline: 1-2 days (priority). Requires both Production + Fulfillment pods.', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
                { tag: 'RTS Production', desc: 'Ready-to-Ship internal production (capsules, vault exclusives, pre-built sets). Timeline: adjustable. Production Pod only — no Fulfillment Pod needed.', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
              ].map((jt) => (
                <div key={jt.tag} className="border border-border/40 rounded-lg p-4">
                  <Badge variant="outline" className={cn('mb-2', jt.color)}>{jt.tag}</Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">{jt.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Module Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gold" />
            Module-by-Module Guide
          </h3>

          {modules.map((mod) => {
            const isExpanded = expandedModule === mod.name;
            const Icon = mod.icon;
            return (
              <Card key={mod.name} className={cn('border-border/40 transition-all', isExpanded && 'ring-1 ring-gold/30')}>
                <button
                  className="w-full text-left p-5 flex items-center gap-4"
                  onClick={() => setExpandedModule(isExpanded ? null : mod.name)}
                >
                  <div className={cn('w-12 h-12 rounded-xl border flex items-center justify-center shrink-0', mod.color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm">{mod.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{mod.description}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
                </button>

                {isExpanded && (
                  <CardContent className="px-5 pb-5 pt-0 space-y-5">
                    <div className="border-t border-border/30 pt-4" />

                    {/* How It Works */}
                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Workflow className="w-3.5 h-3.5" /> How It Works
                      </h5>
                      <ol className="space-y-2">
                        {mod.howItWorks.map((step, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <span className="w-5 h-5 rounded-full bg-gold/10 text-gold text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-muted-foreground">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Key Features */}
                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" /> Key Features
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {mod.keyFeatures.map((feat, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tips */}
                    <div className="bg-gold/5 border border-gold/20 rounded-lg p-4">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-gold mb-3 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" /> Pro Tips
                      </h5>
                      <ul className="space-y-2">
                        {mod.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <ArrowRight className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Go to Module */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gold/30 text-gold hover:bg-gold/10"
                      onClick={() => setLocation(mod.link)}
                    >
                      Open {mod.name} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Station Operations */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Factory className="w-5 h-5 text-info" />
              Station Operations (Inside Pods)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Each pod contains the same set of station operations. Operators navigate between stations as jobs progress through the pipeline.
              Stations are functional — there are no station numbers, just the operation name.
            </p>
            <div className="space-y-3">
              {stationOps.map((station, i) => {
                const Icon = station.icon;
                return (
                  <div key={station.name} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-card/50">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                      <Icon className={cn('w-5 h-5', station.color)} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{station.name}</p>
                      <p className="text-xs text-muted-foreground">{station.desc}</p>
                    </div>
                    {i < stationOps.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1 ml-auto" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Pod Roles */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-5 h-5 text-info" />
              Pod Roles & Team Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Each pod is a self-contained team with clear role hierarchy. Members are assigned based on experience and skill.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roles.map((role) => (
                <div key={role.name} className="border border-border/30 rounded-lg p-4 text-center">
                  <Badge variant="outline" className={cn('mb-3', role.badge)}>{role.name}</Badge>
                  <p className="text-xs text-muted-foreground">{role.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Operations Tools */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-5 h-5 text-info" />
              Operations Tools (Shared Infrastructure)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These tools are shared across all pods and support the overall operations workflow.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: 'Vault Guardian', desc: 'Monitors perfume inventory levels, tracks bottle status, and alerts when stock runs low. The watchdog for your sealed vault.', icon: Shield, link: '/ops/vault-guardian' },
                { name: 'Manual Decant', desc: 'For ad-hoc decanting outside of job pipelines. Record manual fills, track ml usage, and maintain accurate inventory.', icon: Boxes, link: '/ops/manual-decant' },
                { name: 'Print Queue', desc: 'Centralized print management for all pods. Labels, shipping stickers, inserts — all print jobs flow through here.', icon: Printer, link: '/ops/print-queue' },
              ].map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.name}
                    className="border border-border/30 rounded-lg p-4 text-left hover:border-gold/30 transition-colors"
                    onClick={() => setLocation(tool.link)}
                  >
                    <Icon className="w-6 h-6 text-gold mb-2" />
                    <p className="font-semibold text-sm mb-1">{tool.name}</p>
                    <p className="text-xs text-muted-foreground">{tool.desc}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Reference */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-gold" />
              Quick Reference — Common Workflows
            </h3>
            <div className="space-y-4">
              {[
                {
                  title: 'Process a Subscription Cycle',
                  steps: ['Lock the cycle in Subscription Management', 'Go to Order Grouping → group subscription orders', 'Tag as "Subscription" → Create Job', 'Allocate to Production Pod + Fulfillment Pod', 'Pod picks job from Production Queue → processes through pipeline', 'Completed job flows to Fulfillment Queue → fulfillment pod ships'],
                },
                {
                  title: 'Handle an Urgent On-Demand Order',
                  steps: ['Go to Order Grouping → select the urgent order', 'Tag as "On-Demand" → Create Job', 'Set priority to "Urgent" or "VIP" in Production Queue', 'Pod picks the urgent job first (highest priority)', 'Fast-track through pipeline → ship within 1-2 days'],
                },
                {
                  title: 'Build Ready-to-Ship Products',
                  steps: ['Go to Order Grouping → create internal production group', 'Tag as "RTS Production" → Create Job', 'Allocate to Production Pod only (no Fulfillment Pod needed)', 'Pod processes through Picking → Labeling → Decanting → QC', 'Completed products go to RTS inventory — ready for instant shipping'],
                },
              ].map((wf) => (
                <div key={wf.title} className="border border-border/30 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-3">{wf.title}</h4>
                  <div className="flex flex-wrap items-center gap-1">
                    {wf.steps.map((step, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">{step}</Badge>
                        {i < wf.steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
