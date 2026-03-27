// ============================================================
// Sidebar Navigation — Maison Em OS v2.0
// Design: "Maison Ops" — deep navy sidebar with gold accents
// Role-based filtering: each nav item specifies which roles can see it
// Structure: Pod-Based Queue Fulfillment Architecture
// Orders → Jobs → Queues → Pods pull & execute
// ============================================================

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';
import {
  LayoutDashboard, Factory, Beaker, ShoppingCart, Package, Database,
  Settings, ChevronDown, ChevronRight, Warehouse, ClipboardList,
  Printer, FlaskConical, Truck, CheckSquare, ScanBarcode, Box,
  Users, Shield, BookOpen, Droplets, Tag, MapPin, Pipette,
  PackageOpen, RotateCcw, Layers, Building2, BarChart3, DollarSign, TrendingUp, Percent, Sparkles, Heart, FileText,
  Puzzle, BarChart2, Briefcase, CalendarDays, Gem, Lock, Gift,
  CreditCard, Building, Timer, Library, Wrench, UserCheck, Zap, Key, RefreshCw, Wind, PackageCheck,
  Kanban, GanttChart, UserCog, Boxes, CircleDot, Cog, Activity, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Role groups
const ALL_ROLES: UserRole[] = ['owner', 'admin', 'system_architect', 'inventory_admin', 'qc', 'viewer', 'vault_guardian', 'pod_junior', 'pod_leader', 'pod_senior'];
const ADMIN_PLUS: UserRole[] = ['owner', 'admin'];
const OPS_MGMT: UserRole[] = ['owner', 'admin', 'pod_leader'];
const ALL_OPS: UserRole[] = ['owner', 'admin', 'pod_leader', 'pod_senior', 'pod_junior'];
const ALL_OPS_QC: UserRole[] = [...ALL_OPS, 'qc'];
const INVENTORY_PLUS: UserRole[] = ['owner', 'admin', 'inventory_admin', 'system_architect', 'vault_guardian'];

interface NavItem {
  label: string;
  path?: string;
  icon: React.ElementType;
  permission?: string;
  roles?: UserRole[];
  children?: NavItem[];
  badge?: string;
}

const navItems: NavItem[] = [
  // Welcome — everyone
  { label: 'Welcome', path: '/welcome', icon: Sparkles },

  // 1) Dashboard
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'system_architect', 'inventory_admin', 'qc', 'pod_leader', 'viewer'] },

  // ═══════════════════════════════════════════════════════
  // MASTER PODS & JOBS — Admin overview, pod CRUD, analytics
  // ═══════════════════════════════════════════════════════
  { label: 'Master Pods & Jobs', path: '/ops/master-dashboard', icon: Kanban, roles: OPS_MGMT },

  // ═══════════════════════════════════════════════════════
  // POD FRAMEWORK — Operator station view + production ops
  // Pod Dashboard is the operator's entry point; station ops
  // are the individual workflow stages within a pod
  // ═══════════════════════════════════════════════════════
  {
    label: 'Pod Framework', icon: Activity,
    roles: [...OPS_MGMT, 'pod_senior', 'pod_junior', 'qc', 'vault_guardian'],
    children: [
      // ── Pod Operator Station ──
      { label: 'Pod Dashboard', path: '/ops/pod-dashboard', icon: LayoutDashboard, roles: ALL_OPS_QC },

      // ── Production Ops (within pod) ──
      { label: 'Picking Ops', path: '/ops/picking', icon: Package, permission: 'station_2' },
      { label: 'Labeling Ops', path: '/ops/labeling', icon: Tag, permission: 'station_3' },
      { label: 'Decanting Ops', path: '/ops/decanting', icon: FlaskConical, permission: 'station_4' },
      { label: 'QC & Assembly Ops', path: '/ops/qc-assembly', icon: CheckSquare, permission: 'station_5' },

      // ── Fulfillment Ops (within pod) ──
      { label: 'Shipping & Dispatch', path: '/ops/shipping', icon: Truck, permission: 'station_6' },
    ],
  },

  // ═══════════════════════════════════════════════════════
  // JOBS & QUEUE MANAGEMENT — Order → Job → Queue → Pod
  // ═══════════════════════════════════════════════════════
  {
    label: 'Jobs & Queue Mgmt', icon: GanttChart,
    roles: [...OPS_MGMT, 'pod_senior', 'pod_junior', 'qc'],
    children: [
      { label: 'Order Grouping', path: '/ops/order-grouping', icon: Layers, roles: OPS_MGMT },
      { label: 'Job Allocation', path: '/ops/job-allocation', icon: GanttChart, roles: OPS_MGMT },
      { label: 'Production Queue', path: '/ops/production-queue', icon: Factory, roles: ALL_OPS_QC },
      { label: 'Fulfillment Queue', path: '/ops/fulfillment-queue', icon: PackageCheck, roles: ALL_OPS_QC },

    ],
  },

  // ═══════════════════════════════════════════════════════
  // SHARED OPERATIONS INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════
  {
    label: 'Ops Tools', icon: Wrench,
    roles: [...OPS_MGMT, 'pod_senior', 'pod_junior', 'qc', 'vault_guardian'],
    children: [
      { label: 'Vault Guardian', path: '/vault-guardian', icon: Shield, roles: ['owner', 'admin', 'vault_guardian', 'pod_leader'] },
      { label: 'Manual Decant', path: '/manual-decant', icon: Beaker, roles: ALL_OPS },
      { label: 'Print Queue', path: '/print-queue', icon: Printer, roles: ['owner', 'admin', 'pod_senior', 'pod_junior', 'pod_leader'] },
    ],
  },

  // ═══════════════════════════════════════════════════════
  // COMMERCIAL & CX
  // ═══════════════════════════════════════════════════════

  // Orders & CX
  {
    label: 'Orders & CX', icon: ShoppingCart,
    roles: ['owner', 'admin', 'qc', 'viewer', 'pod_leader', 'pod_junior'],
    children: [
      { label: 'Orders', path: '/orders/one-time', icon: ShoppingCart },
      { label: 'Returns', path: '/orders/returns', icon: RotateCcw },
      { label: 'Exchanges', path: '/orders/exchanges', icon: RotateCcw },
    ],
  },

  // CRM — moved below Orders & CX per user request
  {
    label: 'CRM', icon: Users,
    roles: ['owner', 'admin', 'pod_leader', 'system_architect'],
    children: [
      { label: 'Customer Profiles', path: '/crm/customers', icon: Users },
      { label: 'Subscription Health', path: '/crm/subscription-health', icon: Heart },
      { label: 'Promo Codes', path: '/crm/promo-codes', icon: Percent },
    ],
  },

  // Subscription Management
  {
    label: 'Subscription Management', icon: CalendarDays,
    roles: ['owner', 'admin', 'pod_leader', 'system_architect'],
    children: [
      { label: 'Perfume of the Month', path: '/orders/potm', icon: Sparkles },
      { label: 'Perfume Forecast', path: '/subscriptions/forecast', icon: TrendingUp },
      { label: 'Demand Planning', path: '/subscriptions/demand', icon: BarChart2 },
      { label: 'Active Cycle', path: '/subscriptions/active-cycle', icon: RefreshCw },
      { label: 'Cycle History', path: '/subscriptions/cycle-history', icon: CalendarDays },
    ],
  },

  // Procurement
  {
    label: 'Procurement', icon: Truck,
    roles: ['owner', 'admin', 'inventory_admin', 'vault_guardian'],
    children: [
      { label: 'Quick PO', path: '/procurement/quick-po', icon: Zap },
      { label: 'Purchase Orders', path: '/procurement/purchase-orders', icon: ClipboardList },
      { label: 'Suppliers', path: '/master/suppliers', icon: Users },
    ],
  },

  // BOM & Products
  {
    label: 'BOM & Products', icon: Puzzle,
    roles: ['owner', 'admin', 'system_architect'],
    children: [
      { label: 'End Products', path: '/bom/end-products', icon: Box },
      { label: 'BOMs Creation', path: '/bom/boms-creation', icon: Layers },
      { label: 'Component Library', path: '/bom/components', icon: Package },
    ],
  },

  // Inventory
  {
    label: 'Inventory', icon: Package,
    roles: ['owner', 'admin', 'inventory_admin', 'system_architect', 'qc', 'vault_guardian', 'pod_leader', 'pod_senior', 'pod_junior'],
    children: [
      { label: 'Ready-to-Ship Products', path: '/ready-to-ship', icon: PackageCheck, roles: ['owner', 'admin', 'pod_leader', 'pod_senior', 'pod_junior'],
        children: [
          { label: 'Production Hub', path: '/ready-to-ship', icon: Factory },
          { label: 'Production Jobs', path: '/ready-to-ship/jobs', icon: Layers },
          { label: 'RTS Finance', path: '/ready-to-ship/rts-finance', icon: DollarSign, roles: ['owner', 'admin', 'inventory_admin'] },
        ],
      },
      { label: 'Stock Registry', path: '/stations/0-stock-register', icon: Warehouse, permission: 'station_0' },
      { label: 'Perfume Inventory', path: '/inventory/sealed-vault', icon: Box },
      { label: 'Decanting Pool', path: '/inventory/decanting-pool', icon: Droplets },
      { label: 'Packaging & Materials', path: '/inventory/packaging', icon: PackageOpen },
      { label: 'Stock Reconciliation', path: '/inventory/reconciliation', icon: CheckSquare, roles: ['owner', 'admin', 'inventory_admin'] },
    ],
  },

  // Master Data
  {
    label: 'Master Data', icon: Database,
    roles: ['owner', 'admin', 'system_architect', 'inventory_admin', 'vault_guardian'],
    children: [
      { label: 'Perfume Master', path: '/master/perfumes', icon: BookOpen },
      { label: 'Brands', path: '/master/brands', icon: Building2 },
      { label: 'Vault Locations', path: '/master/locations', icon: MapPin },
      { label: 'Syringes Registry', path: '/master/syringes', icon: Pipette },
      { label: 'Packaging & Materials', path: '/master/packaging-skus', icon: PackageOpen },
    ],
  },

  // Capsules
  {
    label: 'Capsules', icon: Gem,
    roles: ['owner', 'admin', 'pod_leader', 'system_architect', 'inventory_admin', 'pod_junior'],
    children: [
      { label: 'Active Drops', path: '/capsules', icon: Gem },
      { label: 'Performance', path: '/capsules/performance', icon: BarChart3 },
    ],
  },

  // Em Vault
  {
    label: 'Em Vault', icon: Lock,
    roles: ['owner', 'admin', 'pod_leader', 'system_architect', 'vault_guardian'],
    children: [
      { label: 'Vault Releases', path: '/em-vault', icon: Lock },
      { label: 'Em Vault Access', path: '/em-vault/access', icon: UserCheck },
    ],
  },

  // Gifting
  {
    label: 'Gifting', icon: Gift,
    roles: ['owner', 'admin', 'pod_leader', 'pod_junior'],
    children: [
      { label: 'Gift Sets', path: '/gifting/sets', icon: Gift },
      { label: 'Gift Cards', path: '/gifting/cards', icon: CreditCard },
      { label: 'Gift Subscriptions', path: '/gifting/subscriptions', icon: CalendarDays },
      { label: 'Corporate Gifting', path: '/gifting/corporate', icon: Building },
      { label: 'Gift Set Performance', path: '/gifting/performance', icon: BarChart3 },
    ],
  },

  // Ledger
  {
    label: 'Ledger', icon: DollarSign,
    roles: ['owner', 'admin', 'inventory_admin', 'system_architect', 'viewer'],
    children: [
      { label: 'Timeline', path: '/ledger/timeline', icon: History },
      { label: 'Bottle Ledger', path: '/ledger/bottle', icon: Package },
      { label: 'Decant Ledger', path: '/ledger/decant', icon: Droplets },
      { label: 'Purchase Ledger', path: '/ledger/purchase', icon: ShoppingCart },
      { label: 'RTS Ledger', path: '/ready-to-ship/rts-ledger', icon: BookOpen },
      { label: 'Job Ledger', path: '/ops/job-ledger', icon: GanttChart },
      { label: 'Shipping Ledger', path: '/ledger/shipping', icon: Truck },
    ],
  },

  // Reports
  {
    label: 'Reports', icon: BarChart3,
    roles: ['owner', 'admin', 'system_architect', 'inventory_admin', 'qc', 'viewer', 'pod_leader'],
    children: [
      { label: 'Daily Ops Report', path: '/reports/daily-ops', icon: ClipboardList },
      { label: 'Operator Performance', path: '/reports/operator-performance', icon: BarChart2, roles: ['owner', 'admin', 'pod_leader'] },
      { label: 'Margin Analysis', path: '/reports/margin-analysis', icon: Percent, roles: ['owner', 'admin', 'system_architect'] },
      { label: 'Inventory Cost', path: '/reports/cost', icon: DollarSign, roles: ['owner', 'admin', 'inventory_admin', 'system_architect'] },
      { label: 'Supplier Spend', path: '/reports/supplier-spend', icon: TrendingUp, roles: ['owner', 'admin', 'inventory_admin'] },
      { label: 'Capsule / Vault Sell-Through', path: '/reports/sell-through', icon: Gem, roles: ['owner', 'admin', 'system_architect'] },
      { label: 'Tax & Invoices', path: '/reports/invoices', icon: FileText, roles: ['owner', 'admin'] },
    ],
  },

  // Setup Guides
  {
    label: 'Setup Guides', icon: BookOpen,
    roles: ['owner', 'admin', 'system_architect'],
    children: [
      { label: 'Operations & Pods', path: '/guides/operations', icon: Factory },
      { label: 'Products & BOM', path: '/guides/products', icon: Package },
      { label: 'Orders & CX', path: '/guides/orders', icon: ShoppingCart },
      { label: 'User Access & Roles', path: '/guides/user-access', icon: Users },
      { label: 'BOM Structure', path: '/bom/guide', icon: Puzzle },
      { label: 'Decanting', path: '/guides/decanting', icon: Beaker },
      { label: 'Inventory', path: '/guides/inventory', icon: Package },
      { label: 'Procurement', path: '/guides/procurement', icon: Truck },
      { label: 'Master Data', path: '/guides/master-data', icon: Database },
    ],
  },

  // System Setup
  {
    label: 'System Setup', icon: Wrench,
    roles: ['owner', 'admin', 'system_architect'],
    children: [
      { label: 'Order Definitions', path: '/system-setup/order-definitions', icon: ClipboardList },
      { label: 'Aura Definitions', path: '/master/auras', icon: CircleDot },
      { label: 'Fragrance Families', path: '/master/families', icon: Tag },
      { label: 'Filters & Tags', path: '/master/filters', icon: Shield },
      { label: 'Pricing Rules', path: '/master/pricing', icon: DollarSign },
      { label: 'Subscription Pricing & Setup', path: '/system-setup/subscription-pricing', icon: CalendarDays },
      { label: 'Notes Library', path: '/system-setup/notes-library', icon: Droplets },
      { label: 'Operations Config', path: '/system-setup/operations', icon: Cog },
      { label: 'Operational Defaults', path: '/system-setup/operational-defaults', icon: Activity },
    ],
  },

  // Settings
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['owner', 'admin'] },
];

function NavGroup({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const [location] = useLocation();
  const { hasPermission, user } = useAuth();
  const [isOpen, setIsOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some(c => {
      if (c.path && location.startsWith(c.path)) return true;
      if (c.children) return c.children.some(gc => gc.path && location.startsWith(gc.path));
      return false;
    });
  });

  // Check role-based visibility
  if (item.roles && user) {
    if (!item.roles.includes(user.role)) return null;
  }

  // Check permission-based visibility (legacy)
  if (item.permission && !hasPermission(item.permission)) return null;

  const Icon = item.icon;
  // Exact match only — no startsWith to prevent sibling highlights
  const isActive = item.path ? location === item.path : false;
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    const visibleChildren = item.children!.filter(child => {
      if (child.permission && !hasPermission(child.permission)) return false;
      if (child.roles && user) {
        return child.roles.includes(user.role);
      }
      return true;
    });

    if (visibleChildren.length === 0) return null;

    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-150',
            'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
            isOpen && 'text-sidebar-foreground/90',
            depth > 0 && 'text-[13px] py-2',
          )}
        >
          <Icon className={cn('shrink-0 transition-colors duration-150', depth > 0 ? 'w-4 h-4' : 'w-[18px] h-[18px]', isOpen ? 'text-sidebar-foreground/80' : 'text-sidebar-foreground/40')} />
          <span className="flex-1 text-left">{item.label}</span>
          {item.badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/20 text-gold">
              {item.badge}
            </span>
          )}
          {isOpen
            ? <ChevronDown className="w-4 h-4 opacity-50" />
            : <ChevronRight className="w-4 h-4 opacity-50" />
          }
        </button>
        {isOpen && (
          <div className={cn(
            'ml-3 pl-3 border-l border-sidebar-border/50 mt-1 space-y-0.5 submenu-enter',
            depth > 0 && 'ml-2 pl-2',
          )}>
            {visibleChildren.map(child => (
              <NavGroup key={child.label + (child.path || '')} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.path || '/'}
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-all duration-150 relative',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-[0_0_12px_-3px_oklch(0.70_0.12_85_/_0.25)]'
          : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40',
        depth > 0 && 'text-[13px]',
        depth > 1 && 'text-[12px] py-1.5',
      )}
    >
      {isActive && <div className="absolute left-0 w-[3px] h-6 bg-gold rounded-r" />}
      <Icon className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-gold' : 'text-sidebar-foreground/40', depth > 1 ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]')} />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/20 text-gold">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="w-64 h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border overflow-y-auto">
      {/* Brand header */}
      <div className="px-4 py-5 border-b border-sidebar-border/50">
        <h1 className="text-base font-bold tracking-wide text-sidebar-foreground font-display">Maison Em OS</h1>
        <p className="text-[11px] text-sidebar-foreground/40 tracking-[0.15em] uppercase mt-0.5">Operations Console</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavGroup key={item.label + (item.path || '')} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border/50 text-[11px] text-sidebar-foreground/30">
        v2.0 · Maison Em
      </div>
    </aside>
  );
}
