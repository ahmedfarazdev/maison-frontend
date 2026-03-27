// User Access & Roles Setup Guide — Maison Em OS
// Updated Round 20: 10 roles — removed deprecated ops_subscription, ops_one_time, ops_general, vault_ops, fulfillment_ops

import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Crown, Shield, Wrench, Warehouse, Package, ClipboardCheck, Eye,
  Check, X, Users, Lock, Info, ChevronRight, BookOpen, Beaker, Truck, Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Role Definitions ────────────────────────────────────────
interface RoleDef {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  purpose: string;
  typicalUser: string;
  canSee: string[];
  canEdit: string[];
  canWorkOn: string[];
  cannotAccess: string[];
}

const ROLES: RoleDef[] = [
  {
    id: 'owner',
    label: 'Owner',
    icon: Crown,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    description: 'The business owner with full system access. Has ultimate authority over all operations, settings, and user management.',
    purpose: 'Strategic oversight, financial decisions, system configuration, and team management. The Owner sees everything and controls everything.',
    typicalUser: 'Founder / CEO / Business Owner',
    canSee: ['All dashboards, reports, and analytics', 'All inventory levels and valuations', 'All orders, customers, and financial data', 'User management and role assignments', 'System settings and integrations', 'BOM structures, pricing, and margin analysis', 'Procurement data and supplier contracts'],
    canEdit: ['System settings and configurations', 'User roles and permissions', 'Pricing rules and margin targets', 'BOM templates and product definitions', 'Supplier information and contracts', 'All master data (perfumes, brands, packaging)'],
    canWorkOn: ['Strategic planning using reports and analytics', 'Approving purchase orders and supplier quotes', 'Setting pricing and margin strategies', 'Configuring system-wide settings', 'Managing team access and roles'],
    cannotAccess: ['Nothing — Owner has unrestricted access to all system areas'],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    description: 'Senior operations manager with near-full access. Can manage day-to-day operations, team, and most system settings.',
    purpose: 'Day-to-day operational management, team coordination, and ensuring smooth workflows across all departments.',
    typicalUser: 'Operations Manager / General Manager',
    canSee: ['All dashboards and operational reports', 'All inventory and order data', 'User list and team structure', 'BOM configurations and cost analysis', 'Procurement pipeline and supplier data', 'Customer profiles and subscription health'],
    canEdit: ['Order statuses and fulfillment workflows', 'Inventory adjustments and reconciliations', 'Purchase orders and receiving', 'BOM templates and product configurations', 'Master data (perfumes, packaging, brands)', 'Team schedules and task assignments'],
    canWorkOn: ['Managing daily operations across all stations', 'Reviewing and approving purchase orders', 'Running inventory reconciliations', 'Generating reports for the Owner', 'Handling escalations from other roles'],
    cannotAccess: ['System-level settings (integrations, API keys)', 'Billing and subscription management'],
  },
  {
    id: 'system_architect',
    label: 'System Architect',
    icon: Wrench,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    description: 'The product and system designer who configures BOM structures, defines workflows, and architects the operational backbone.',
    purpose: 'Designing and maintaining the system architecture — BOM structures, product definitions, workflow configurations, and data models.',
    typicalUser: 'Product Architect / Systems Designer / Technical Lead',
    canSee: ['All BOM templates, shipping BOMs, and component library', 'End product definitions and cost structures', 'Master data (perfumes, packaging SKUs, brands)', 'Reports related to BOM and product performance', 'Setup guides and system documentation'],
    canEdit: ['BOM templates (create, modify, version)', 'End product definitions and BOM linkages', 'Component library entries', 'Master data structures and classifications', 'Pricing rules and cost formulas'],
    canWorkOn: ['Designing new product BOMs for launches', 'Optimizing BOM cost structures', 'Setting up new product categories', 'Configuring station workflows', 'Maintaining master data integrity'],
    cannotAccess: ['User management and role assignments', 'Customer data and CRM', 'Order processing and fulfillment actions'],
  },
  {
    id: 'inventory_admin',
    label: 'Inventory Admin',
    icon: Warehouse,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    description: 'Manages all inventory — sealed vault, decanting pool, packaging materials. Responsible for stock accuracy and procurement.',
    purpose: 'Ensuring inventory accuracy, managing stock levels, processing incoming goods, and coordinating with procurement.',
    typicalUser: 'Inventory Manager / Warehouse Supervisor',
    canSee: ['Sealed Vault (full bottle inventory)', 'Decanting Pool (open bottle volumes)', 'Packaging Inventory (materials, atomizers, boxes)', 'Stock reconciliation history', 'Purchase orders and delivery schedules', 'Inventory cost reports'],
    canEdit: ['Stock intake and receiving (Station 0)', 'Inventory adjustments and corrections', 'Stock reconciliation sessions', 'Warehouse locations and bin assignments', 'Reorder points and minimum stock levels'],
    canWorkOn: ['Processing incoming stock deliveries', 'Running periodic stock reconciliations', 'Investigating discrepancies and losses', 'Managing warehouse organization', 'Coordinating with procurement on reorders'],
    cannotAccess: ['Order processing and customer data', 'Financial reports and margin analysis', 'BOM configuration and product design', 'User management and settings'],
  },
  {
    id: 'pod_leader',
    label: 'Pod Leader',
    icon: Briefcase,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    description: 'Oversees all operational activities including work allocation, shift management, operator performance, and station workflows.',
    purpose: 'Managing the operations team — allocating jobs, tracking shifts, reviewing operator performance, and ensuring production targets are met.',
    typicalUser: 'Pod Leader / Operations Lead / Shift Manager',
    canSee: ['All Pod Operations', 'Job Creation and Work Allocation', 'Shift handover reports', 'Operator performance dashboards', 'Orders (read-only)', 'Inventory (read-only)', 'Ledger', 'Daily ops reports and team day tracker'],
    canEdit: ['Job creation (one-time and subscription)', 'Job allocation and operator assignments', 'Shift schedules and handover notes', 'Manual decant requests', 'Print queue jobs'],
    canWorkOn: ['Creating and distributing jobs to operators', 'Managing shift start/end and break tracking', 'Reviewing operator performance and efficiency', 'Handling escalations from station operators', 'Generating daily ops reports'],
    cannotAccess: ['System settings and integrations', 'BOM configuration and product design', 'Procurement and purchase orders', 'User management and role assignments', 'Financial reports (margin, P&L)', 'Master data editing', 'Setup Guides'],
  },
  {
    id: 'pod_senior',
    label: 'Pod Senior Member',
    icon: Beaker,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    borderColor: 'border-teal-200 dark:border-teal-800',
    description: 'Operates all stations S1–S6 (primarily S1–S4). Handles the decanting pipeline from job board through batch decanting, and can assist with fulfillment and shipping.',
    purpose: 'Executing the production pipeline — from receiving job assignments through picking bottles, preparing labels, batch decanting, and assisting with fulfillment when needed.',
    typicalUser: 'Decanting Operator / Production Staff',
    canSee: ['Personal pod dashboard with allocated jobs', 'All Pod Operations', 'Order details for assigned jobs', 'Inventory levels (read-only)', 'Print Queue for label printing'],
    canEdit: ['Job status progression through all stations', 'Batch decanting records and volumes', 'Label printing and prep tasks', 'Manual decant requests', 'Print queue jobs'],
    canWorkOn: ['Processing allocated jobs through all stations', 'Running batch decanting operations', 'Preparing labels and packaging materials', 'Assisting with fulfillment and shipping when needed', 'Updating job progress and completion status'],
    cannotAccess: ['Job Creation and Work Allocation (managed by Pod Leader)', 'Inventory adjustments and management', 'Financial reports and cost data', 'Master data editing', 'User management and settings', 'Procurement and purchase orders', 'Dashboard (uses Pod Dashboard as home)'],
  },
  {
    id: 'pod_junior',
    label: 'Pod Junior Member',
    icon: Package,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    description: 'Operates all stations S1–S6 (primarily S5–S6). Handles fulfillment, packing, quality checks, and shipping, and can assist with decanting stations.',
    purpose: 'Ensuring orders are properly packed, quality-checked, and shipped. Can also assist with earlier stations when needed.',
    typicalUser: 'Packing Staff / Shipping Coordinator',
    canSee: ['Personal pod dashboard with allocated jobs', 'All Pod Operations', 'Orders and CRM (read-only)', 'Inventory levels (read-only)', 'Print Queue for shipping labels'],
    canEdit: ['Fulfillment checklists and packing confirmations', 'Shipping labels and tracking numbers', 'Courier assignments', 'Package weight and dimensions', 'Print queue jobs'],
    canWorkOn: ['Packing orders per BOM specifications', 'Running final quality checks', 'Generating shipping labels', 'Coordinating courier pickups', 'Assisting with decanting stations when needed', 'Updating shipment tracking'],
    cannotAccess: ['Job Creation and Work Allocation (managed by Pod Leader)', 'Inventory management and adjustments', 'Financial data and reports', 'Master data and settings', 'Procurement and purchase orders', 'Dashboard (uses Pod Dashboard as home)'],
  },
  {
    id: 'vault_guardian',
    label: 'Vault Guardian',
    icon: Shield,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    description: 'Manages the physical vault — bottle check-out/check-in, vault inventory, procurement, and master data for stored bottles.',
    purpose: 'Securing and managing the bottle vault. Handles all physical bottle movements, procurement coordination, and vault inventory accuracy.',
    typicalUser: 'Vault Manager / Inventory Custodian',
    canSee: ['Vault Guardian interface (check-out/check-in)', 'Full bottle inventory and vault locations', 'Procurement pipeline and purchase orders', 'Master data (perfumes, brands)', 'Ledger entries for vault movements'],
    canEdit: ['Bottle check-out and check-in records', 'Vault inventory adjustments', 'Purchase orders and receiving', 'Master data entries', 'Vault location assignments'],
    canWorkOn: ['Processing bottle check-out requests (scan to give)', 'Processing bottle returns (scan, notes, empty/broken)', 'Managing vault organization and locations', 'Coordinating procurement and receiving', 'Maintaining vault inventory accuracy'],
    cannotAccess: ['Pod Operations', 'Order processing and CRM', 'Financial reports and margin analysis', 'BOM configuration', 'User management and settings', 'Dashboard', 'Setup Guides'],
  },
  {
    id: 'qc',
    label: 'QC Inspector',
    icon: ClipboardCheck,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800',
    description: 'Quality Control inspector. Reviews at Batch Decanting and Fulfillment. Read access to orders, inventory, and operational reports.',
    purpose: 'Maintaining product quality at key checkpoints — batch decanting (S4) and fulfillment (S5). Monitors quality standards and flags issues.',
    typicalUser: 'Quality Control Inspector / QC Lead',
    canSee: ['Batch Decanting (quality checkpoints)', 'Fulfillment (packing quality)', 'Orders and CRM (read-only)', 'Inventory levels (read-only)', 'Dashboard (read-only)', 'Operational reports (Daily Ops, Subscription Health)'],
    canEdit: ['QC pass/fail decisions at S4 and S5', 'Quality inspection reports', 'Defect logging and categorization'],
    canWorkOn: ['Inspecting batch decanting quality at S4', 'Verifying packed orders at S5', 'Reviewing daily ops reports for quality trends'],
    cannotAccess: ['Job Management (creation, allocation, shifts)', 'S1–S3 and S6 (no direct access)', 'Inventory adjustments', 'Financial data and pricing', 'BOM and product configuration', 'Master data', 'Procurement', 'User management and settings', 'Setup Guides'],
  },
  {
    id: 'viewer',
    label: 'Viewer',
    icon: Eye,
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-50 dark:bg-zinc-900/30',
    borderColor: 'border-zinc-200 dark:border-zinc-700',
    description: 'Read-only access to the system. Can view dashboard, orders, inventory, ledger, and operational reports.',
    purpose: 'Observing operations without the ability to modify anything. Ideal for stakeholders, investors, or team members in training.',
    typicalUser: 'Stakeholder / Investor / Trainee / Auditor',
    canSee: ['Dashboard (read-only)', 'Orders and CRM (read-only)', 'Inventory levels (read-only)', 'Ledger (read-only)', 'Operational reports (Daily Ops, Subscription Health)'],
    canEdit: ['Nothing — Viewer role is strictly read-only'],
    canWorkOn: ['Reviewing operational dashboards', 'Monitoring order fulfillment progress', 'Reviewing ledger and reports'],
    cannotAccess: ['Any edit, create, or delete actions', 'Pod Operations', 'Job Management', 'Financial reports and cost data', 'Master data', 'Procurement', 'BOM configuration', 'User management and settings', 'Setup Guides'],
  },
];

// ─── Permission Matrix ───────────────────────────────────────
type Access = 'full' | 'edit' | 'view' | 'none';

interface PermArea {
  area: string;
  owner: Access;
  admin: Access;
  system_architect: Access;
  inventory_admin: Access;
  pod_leader: Access;
  pod_senior: Access;
  pod_junior: Access;
  vault_guardian: Access;
  qc: Access;
  viewer: Access;
}

const PERMISSION_MATRIX: PermArea[] = [
  { area: 'Dashboard', owner: 'full', admin: 'full', system_architect: 'view', inventory_admin: 'view', pod_leader: 'full', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'view', viewer: 'view' },
  { area: 'Job Creation', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'none', pod_leader: 'full', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Job Allocation', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'none', pod_leader: 'full', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Pod Dashboard', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'none', pod_leader: 'full', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Vault Guardian', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'none', pod_leader: 'view', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'full', qc: 'none', viewer: 'none' },
  { area: 'Print Queue', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'none', pod_leader: 'full', pod_senior: 'edit', pod_junior: 'edit', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Pod Framework (All Stations)', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'none', pod_leader: 'full', pod_senior: 'edit', pod_junior: 'edit', vault_guardian: 'none', qc: 'view', viewer: 'none' },
  { area: 'Manual Decant', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'none', pod_leader: 'full', pod_senior: 'edit', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Orders & CRM', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'none', pod_leader: 'view', pod_senior: 'view', pod_junior: 'view', vault_guardian: 'none', qc: 'view', viewer: 'view' },
  { area: 'Inventory (All)', owner: 'full', admin: 'full', system_architect: 'view', inventory_admin: 'full', pod_leader: 'view', pod_senior: 'view', pod_junior: 'view', vault_guardian: 'full', qc: 'view', viewer: 'view' },
  { area: 'Stock Reconciliation', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'edit', pod_leader: 'none', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Master Data', owner: 'full', admin: 'full', system_architect: 'full', inventory_admin: 'full', pod_leader: 'none', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'full', qc: 'none', viewer: 'none' },
  { area: 'BOM Setup', owner: 'full', admin: 'full', system_architect: 'full', inventory_admin: 'none', pod_leader: 'none', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Procurement & POs', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'full', pod_leader: 'none', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'full', qc: 'none', viewer: 'none' },
  { area: 'Ledger', owner: 'full', admin: 'full', system_architect: 'view', inventory_admin: 'view', pod_leader: 'view', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'view', qc: 'none', viewer: 'view' },
  { area: 'Reports (Financial)', owner: 'full', admin: 'full', system_architect: 'view', inventory_admin: 'view', pod_leader: 'none', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Reports (Operational)', owner: 'full', admin: 'full', system_architect: 'view', inventory_admin: 'view', pod_leader: 'full', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'view', viewer: 'view' },
  { area: 'User Management', owner: 'full', admin: 'full', system_architect: 'none', inventory_admin: 'none', pod_leader: 'none', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Settings', owner: 'full', admin: 'full', system_architect: 'view', inventory_admin: 'none', pod_leader: 'none', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
  { area: 'Setup Guides', owner: 'full', admin: 'full', system_architect: 'full', inventory_admin: 'none', pod_leader: 'none', pod_senior: 'none', pod_junior: 'none', vault_guardian: 'none', qc: 'none', viewer: 'none' },
];

const ACCESS_CONFIG: Record<Access, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  full: { icon: Check, label: 'Full', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  edit: { icon: Check, label: 'Edit', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  view: { icon: Eye, label: 'View', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  none: { icon: X, label: 'None', color: 'text-zinc-400', bg: 'bg-zinc-50 dark:bg-zinc-900/30' },
};

// ─── Role Detail Card ────────────────────────────────────────
function RoleDetailCard({ role }: { role: RoleDef }) {
  const Icon = role.icon;
  return (
    <Card className={cn('border-2 transition-all hover:shadow-md', role.borderColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', role.bgColor)}>
            <Icon className={cn('w-6 h-6', role.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              {role.label}
              <Badge variant="outline" className={cn('text-[10px]', role.color)}>{role.id}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purpose</span>
          </div>
          <p className="text-sm">{role.purpose}</p>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>Typical user: <strong className="text-foreground">{role.typicalUser}</strong></span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Can See</span>
            </div>
            <ul className="space-y-1">
              {role.canSee.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-blue-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Can Edit</span>
            </div>
            <ul className="space-y-1">
              {role.canEdit.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Works On</span>
            </div>
            <ul className="space-y-1">
              {role.canWorkOn.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-red-600">No Access</span>
            </div>
            <ul className="space-y-1">
              {role.cannotAccess.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <X className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Access Cell ─────────────────────────────────────────────
function AccessCell({ access }: { access: Access }) {
  const config = ACCESS_CONFIG[access];
  const Icon = config.icon;
  return (
    <div className={cn('flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[10px] font-medium', config.bg, config.color)}>
      <Icon className="w-3 h-3" />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function UserAccessGuide() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="User Access & Roles"
        subtitle="10 system roles — permissions, responsibilities, and access levels"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Setup Guides', href: '/guides/user-access' },
          { label: 'User Access & Roles' },
        ]}
      />

      <div className="p-6 space-y-8">
        {/* Overview */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="py-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">Role-Based Access Control (RBAC)</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Maison Em OS uses a role-based access control system with <strong>10 distinct roles</strong>. Each role is designed
                  for a specific function within the organization — from strategic oversight (Owner) to focused operational tasks
                  (Pod Senior, Pod Junior). The Pod Leader manages work allocation and team performance,
                  while the Vault Guardian secures the physical bottle vault. Assign roles carefully to maintain security while enabling efficient workflows.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="roles" className="space-y-6">
          <TabsList>
            <TabsTrigger value="roles" className="gap-1.5">
              <Users className="w-3.5 h-3.5" /> Role Details
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Permission Matrix
            </TabsTrigger>
            <TabsTrigger value="guide" className="gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Assignment Guide
            </TabsTrigger>
          </TabsList>

          {/* ── Role Details Tab ── */}
          <TabsContent value="roles" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRole(null)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                  !selectedRole ? 'bg-foreground text-background border-foreground' : 'bg-muted/30 border-border hover:bg-muted/50',
                )}
              >
                All Roles
              </button>
              {ROLES.map(role => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(selectedRole === role.id ? null : role.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                      selectedRole === role.id
                        ? cn(role.bgColor, role.borderColor, role.color)
                        : 'bg-muted/30 border-border hover:bg-muted/50',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {role.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {ROLES.filter(r => !selectedRole || r.id === selectedRole).map(role => (
                <RoleDetailCard key={role.id} role={role} />
              ))}
            </div>
          </TabsContent>

          {/* ── Permission Matrix Tab ── */}
          <TabsContent value="matrix" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider min-w-[180px]">System Area</th>
                        {ROLES.map(role => {
                          const Icon = role.icon;
                          return (
                            <th key={role.id} className="text-center py-3 px-2 min-w-[70px]">
                              <div className="flex flex-col items-center gap-1">
                                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', role.bgColor)}>
                                  <Icon className={cn('w-3.5 h-3.5', role.color)} />
                                </div>
                                <span className="text-[10px] font-semibold">{role.label}</span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_MATRIX.map((row, i) => (
                        <tr key={row.area} className={cn('border-b', i % 2 === 0 && 'bg-muted/10')}>
                          <td className="py-2.5 px-4 font-medium text-xs">{row.area}</td>
                          {ROLES.map(role => (
                            <td key={role.id} className="py-2.5 px-2">
                              <AccessCell access={row[role.id as keyof PermArea] as Access} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-4">
              {Object.entries(ACCESS_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <div key={key} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium', config.bg, config.color)}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{config.label}: {key === 'full' ? 'Create, edit, delete' : key === 'edit' ? 'Edit existing' : key === 'view' ? 'Read-only' : 'No access'}</span>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Assignment Guide Tab ── */}
          <TabsContent value="guide" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">When to Assign Each Role</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { role: 'Owner', when: 'Business founder or CEO who needs full visibility and control over all operations and finances.' },
                    { role: 'Admin', when: 'Operations manager who runs day-to-day activities and needs broad access without system-level settings.' },
                    { role: 'System Architect', when: 'Technical lead or product designer who configures BOMs, workflows, and master data structures.' },
                    { role: 'Inventory Admin', when: 'Warehouse manager responsible for stock accuracy, receiving goods, and managing storage.' },
                    { role: 'Pod Leader', when: 'Operations lead who allocates jobs, manages shifts, and reviews operator performance.' },
                    { role: 'Pod Senior', when: 'Production operator who works on decanting stations S1–S4 (picking, prep, batch decanting).' },
                    { role: 'Pod Junior', when: 'Packing and shipping staff focused on stations S5–S6 (fulfillment and shipping).' },
                    { role: 'Vault Guardian', when: 'Vault custodian who manages bottle check-out/check-in, vault inventory, and procurement.' },
                    { role: 'QC', when: 'Quality inspector who checks incoming goods, decanted products, and packed orders.' },
                    { role: 'Viewer', when: 'Stakeholders, investors, trainees, or auditors who need to observe but not modify.' },
                  ].map(item => (
                    <div key={item.role} className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5 text-[10px]">{item.role}</Badge>
                      <p className="text-xs text-muted-foreground">{item.when}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Best Practices</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { title: 'Principle of Least Privilege', desc: 'Assign the minimum role needed for each person\'s job function. Start with Viewer and upgrade as needed.' },
                    { title: 'Separate Concerns', desc: 'Keep decanting (Pod Senior) and fulfillment (Pod Junior) as separate roles for accountability.' },
                    { title: 'Operations Lead', desc: 'Assign Pod Leader to the person managing work allocation and shift schedules — not to individual operators.' },
                    { title: 'Vault Security', desc: 'Only assign Vault Guardian to trusted personnel who physically handle bottles. This role has procurement access.' },
                    { title: 'Regular Review', desc: 'Review role assignments quarterly. Remove access for departed team members immediately.' },
                    { title: 'Training First', desc: 'Start new team members as Viewers. Upgrade their role only after they complete the relevant Setup Guides.' },
                  ].map(item => (
                    <div key={item.title} className="bg-muted/20 rounded-lg p-2.5">
                      <p className="text-xs font-semibold mb-0.5">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recommended Team Structure by Scale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      scale: 'Startup (1–3 people)',
                      roles: ['1 Owner (does everything)', '1 Pod Senior', '1 Viewer (investor/advisor)'],
                      note: 'Owner doubles as Admin, Head of Ops, and Vault Guardian',
                    },
                    {
                      scale: 'Growing (4–8 people)',
                      roles: ['1 Owner', '1 Admin', '1 Pod Leader', '1 Inventory Admin', '2 Pod Seniors', '1 Pod Junior', '1 Vault Guardian'],
                      note: 'Clear role separation begins — dedicated ops lead',
                    },
                    {
                      scale: 'Scaled (9+ people)',
                      roles: ['1 Owner', '1–2 Admins', '1 System Architect', '1–2 Inventory Admins', '1 Pod Leader', '3+ Pod Seniors', '2+ Pod Juniors', '1 Vault Guardian', '1–2 QC'],
                      note: 'Full specialization with shift coverage',
                    },
                  ].map(item => (
                    <div key={item.scale} className="bg-muted/20 rounded-lg p-4">
                      <h4 className="font-semibold text-sm mb-2">{item.scale}</h4>
                      <ul className="space-y-1 mb-2">
                        {item.roles.map((r, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-gold shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-muted-foreground/70 italic">{item.note}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
