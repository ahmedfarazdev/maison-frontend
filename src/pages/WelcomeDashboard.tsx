// Welcome Dashboard — Maison Em OS
// Role-specific landing page: each role sees tailored greeting, quick actions, stats, and modules
// Round 24: Dynamic content per role

import { useState, useMemo } from 'react';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'wouter';
import {
  Sparkles, ArrowRight, Search, Play, RotateCcw, Beaker, Warehouse,
  ShoppingCart, FlaskConical, Truck, Package, BarChart3, Settings,
  BookOpen, Users, Shield, Puzzle, Factory, Database, Layers,
  DollarSign, Heart, ClipboardList, Percent, FileText, Box,
  ChevronRight, Droplets, Wine, TrendingUp, Zap, Globe,
  Clock, CheckCircle2, AlertTriangle, Target, MapPin,
  Briefcase, UserCheck, Eye, Wrench, Printer, CalendarDays,
  Timer, Activity, Star, Coffee, Sun, Scan, Lock,
  LayoutDashboard, ListChecks, GripVertical, ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { UserRole, DashboardKPIs, InventoryAlert, ActivityEvent } from '@/types';

// ─── Role Configuration ────────────────────────────────────
interface RoleConfig {
  greeting: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  quickActions: QuickAction[];
  modules: ModuleCard[];
  tips: string[];
}

interface QuickAction {
  label: string;
  path: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

interface ModuleCard {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  path: string;
  features: string[];
}

// ─── Role-Specific Configurations ──────────────────────────
const getRoleConfig = (role: UserRole, userName: string): RoleConfig => {
  const configs: Record<string, RoleConfig> = {
    // ── Owner / Admin ──
    owner: {
      greeting: `Welcome back, ${userName}`,
      subtitle: 'Full System Command Center',
      description: 'You have complete access to every module in Maison Em OS. Monitor operations, review financials, manage team access, and oversee the entire pipeline from procurement to shipping.',
      icon: Sparkles,
      accentColor: 'text-gold',
      accentBg: 'from-gold/10 to-amber-500/5',
      quickActions: [
        { label: 'Capsules', path: '/capsules', icon: Star, color: 'text-purple-600', description: 'Manage limited drops' },
        { label: 'Em Vault', path: '/em-vault', icon: Lock, color: 'text-gold', description: 'Curated vault releases' },
        { label: 'Gifting', path: '/gifting', icon: Heart, color: 'text-pink-600', description: 'Gift sets & wrapping' },
        { label: 'Create Jobs', path: '/job-creation', icon: Briefcase, color: 'text-blue-600', description: 'Create and distribute jobs' },
        { label: 'Manual Decant', path: '/manual-decant', icon: Beaker, color: 'text-emerald-600', description: 'Ad-hoc decanting requests' },
        { label: 'Purchase Orders', path: '/procurement/purchase-orders', icon: Truck, color: 'text-indigo-600', description: 'Manage procurement' },
        { label: 'Daily Ops Report', path: '/reports/daily-ops', icon: ClipboardList, color: 'text-cyan-600', description: 'Today\'s operations summary' },
        { label: 'Settings', path: '/settings', icon: Settings, color: 'text-zinc-600', description: 'System configuration' },
      ],
      modules: [
        { id: 'capsules', name: 'Capsules', description: 'Public limited drops — themed sets, house chapters, layering', icon: Star, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30', path: '/capsules', features: ['Themed Sets', 'House Chapters', 'Layering Sets'] },
        { id: 'em_vault', name: 'Em Vault', description: 'Curated rotational vault with multiple active releases', icon: Lock, color: 'text-gold', bgColor: 'bg-amber-50 dark:bg-amber-950/30', path: '/em-vault', features: ['Active Releases', 'Access Codes', 'Rotation'] },
        { id: 'gifting', name: 'Gifting', description: 'Gift sets, wrapping, personalization, corporate', icon: Heart, color: 'text-pink-600', bgColor: 'bg-pink-50 dark:bg-pink-950/30', path: '/gifting', features: ['Pre-Built', 'Custom', 'Corporate', 'Seasonal'] },
        { id: 'stations', name: 'Pod Operations', description: 'Pod-based pipeline from queue to shipping', icon: FlaskConical, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', path: '/ops/pod-dashboard', features: ['Pod Dashboard', 'Picking', 'Labeling', 'Decanting', 'QC & Assembly', 'Shipping'] },
        { id: 'orders', name: 'Orders & CRM', description: 'One-time orders, subscriptions, returns, customers', icon: ShoppingCart, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', path: '/orders/one-time', features: ['One-Time', 'Subscriptions', 'Returns', 'Customers'] },
        { id: 'inventory', name: 'Inventory', description: 'Sealed vault, decanting pool, packaging, reconciliation', icon: Warehouse, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', path: '/inventory/sealed-vault', features: ['Sealed Vault', 'Decanting Pool', 'Packaging', 'Reconciliation'] },
        { id: 'procurement', name: 'Procurement', description: 'Purchase orders, suppliers, receiving', icon: Truck, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30', path: '/procurement/purchase-orders', features: ['Purchase Orders', 'Suppliers', 'QC Inspection'] },
        { id: 'bom', name: 'BOM Setup', description: 'Simplified flat component lists', icon: Puzzle, color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-950/30', path: '/bom/end-products', features: ['End Products', 'Components', 'Cost Structures'] },
        { id: 'master', name: 'Master Data', description: 'Perfume registry, brands, packaging, suppliers', icon: Database, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30', path: '/master/perfumes', features: ['Perfumes', 'Brands', 'Packaging SKUs', 'Suppliers'] },
        { id: 'reports', name: 'Reports', description: 'Operational and financial insights', icon: BarChart3, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30', path: '/reports/guide', features: ['Daily Ops', 'Margin', 'P&L', 'Revenue'] },
        { id: 'ledger', name: 'Financial Ledger', description: 'Complete transaction history and records', icon: FileText, color: 'text-zinc-600', bgColor: 'bg-zinc-50 dark:bg-zinc-900/30', path: '/ledger', features: ['Transactions', 'Cost Tracking', 'Revenue'] },
      ],
      tips: [
        'Use the Ops Dashboard for a real-time overview of your entire pipeline.',
        'Check Operator Performance under Reports to review team efficiency.',
        'Run the Daily Ops Report at end-of-day for a complete operational summary.',
      ],
    },

    // ── System Architect ──
    system_architect: {
      greeting: `Hello, ${userName}`,
      subtitle: 'System Architecture & Configuration',
      description: 'Your focus is on the technical foundation — BOM structures, master data integrity, inventory configuration, and system setup. You design the data models that power every operation.',
      icon: Wrench,
      accentColor: 'text-indigo-600',
      accentBg: 'from-indigo-500/10 to-violet-500/5',
      quickActions: [
        { label: 'BOM Setup', path: '/bom/end-products', icon: Puzzle, color: 'text-rose-600', description: 'Product definitions & costs' },
        { label: 'Master Data', path: '/master/perfumes', icon: Database, color: 'text-indigo-600', description: 'Perfume registry & brands' },
        { label: 'Inventory', path: '/inventory/sealed-vault', icon: Warehouse, color: 'text-amber-600', description: 'Stock levels & reconciliation' },
        { label: 'Ledger', path: '/ledger', icon: FileText, color: 'text-zinc-600', description: 'Financial records' },
        { label: 'BOM Pricing', path: '/reports/bom-pricing', icon: DollarSign, color: 'text-emerald-600', description: 'Cost vs selling prices' },
        { label: 'Setup Guides', path: '/guides/master-data', icon: BookOpen, color: 'text-blue-600', description: 'Configuration guides' },
      ],
      modules: [
        { id: 'bom', name: 'BOM Setup', description: 'Define product structures, components, and cost models', icon: Puzzle, color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-950/30', path: '/bom/end-products', features: ['End Products', 'BOMs Creation', 'Component Library', 'Shipping BOMs'] },
        { id: 'master', name: 'Master Data', description: 'Perfume registry, brands, packaging SKUs, suppliers', icon: Database, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30', path: '/master/perfumes', features: ['Perfumes', 'Brands', 'Packaging SKUs', 'Suppliers', 'Aura Definitions'] },
        { id: 'inventory', name: 'Inventory', description: 'Monitor stock levels and reconciliation', icon: Warehouse, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', path: '/inventory/sealed-vault', features: ['Sealed Vault', 'Decanting Pool', 'Packaging', 'Reconciliation'] },
        { id: 'reports', name: 'Reports', description: 'Cost analysis, BOM pricing, margin reports', icon: BarChart3, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30', path: '/reports/guide', features: ['BOM Pricing', 'Margin Analysis', 'Product P&L', 'Revenue Comparison'] },
      ],
      tips: [
        'Start with Master Data to ensure all perfumes, brands, and SKUs are properly registered.',
        'Use BOM Setup to define cost structures before configuring pricing.',
        'Check the Setup Guides for step-by-step configuration walkthroughs.',
      ],
    },

    // ── Inventory Admin ──
    inventory_admin: {
      greeting: `Good day, ${userName}`,
      subtitle: 'Inventory & Procurement Control',
      description: 'You manage the physical and financial side of inventory — stock levels, purchase orders, supplier relationships, and cost tracking. Keep the vault stocked and the numbers accurate.',
      icon: Warehouse,
      accentColor: 'text-amber-600',
      accentBg: 'from-amber-500/10 to-orange-500/5',
      quickActions: [
        { label: 'Sealed Vault', path: '/inventory/sealed-vault', icon: Lock, color: 'text-amber-600', description: 'Full bottle inventory' },
        { label: 'Purchase Orders', path: '/procurement/purchase-orders', icon: Truck, color: 'text-purple-600', description: 'Create & manage POs' },
        { label: 'Master Data', path: '/master/perfumes', icon: Database, color: 'text-indigo-600', description: 'Perfume & supplier data' },
        { label: 'Ledger', path: '/ledger', icon: FileText, color: 'text-zinc-600', description: 'Financial records' },
        { label: 'Inventory Cost', path: '/reports/inventory-cost', icon: DollarSign, color: 'text-emerald-600', description: 'Cost analysis report' },
        { label: 'Reconciliation', path: '/inventory/reconciliation', icon: ArrowUpDown, color: 'text-blue-600', description: 'Stock reconciliation' },
      ],
      modules: [
        { id: 'inventory', name: 'Inventory Management', description: 'Sealed vault, decanting pool, packaging materials', icon: Warehouse, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', path: '/inventory/sealed-vault', features: ['Sealed Vault', 'Decanting Pool', 'Packaging', 'Reconciliation'] },
        { id: 'procurement', name: 'Procurement', description: 'Purchase orders, supplier management, receiving', icon: Truck, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30', path: '/procurement/purchase-orders', features: ['Purchase Orders', 'Suppliers', 'QC Inspection', 'Delivery Tracking'] },
        { id: 'master', name: 'Master Data', description: 'Perfume registry, brands, packaging SKUs, suppliers', icon: Database, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30', path: '/master/perfumes', features: ['Perfumes', 'Brands', 'Packaging SKUs', 'Suppliers'] },
        { id: 'ledger', name: 'Financial Ledger', description: 'Transaction history and cost tracking', icon: FileText, color: 'text-zinc-600', bgColor: 'bg-zinc-50 dark:bg-zinc-900/30', path: '/ledger', features: ['Transactions', 'Cost Tracking', 'Revenue Records'] },
      ],
      tips: [
        'Check the Sealed Vault daily to monitor stock levels and identify low-stock items.',
        'Use the Inventory Cost report to track cost trends across suppliers.',
        'Run Stock Reconciliation weekly to catch discrepancies early.',
      ],
    },

    // ── Pod Leader ──
    pod_leader: {
      greeting: `Good morning, ${userName}`,
      subtitle: 'Operations Command Center',
      description: 'You oversee the entire operations floor — team management, job allocation, station monitoring, and performance tracking. Your dashboard is designed for real-time operational awareness.',
      icon: Activity,
      accentColor: 'text-blue-600',
      accentBg: 'from-blue-500/10 to-cyan-500/5',
      quickActions: [
        { label: 'Create Jobs', path: '/job-creation', icon: Briefcase, color: 'text-gold', description: 'Create & distribute jobs' },
        { label: 'Work Allocation', path: '/work-allocation', icon: GripVertical, color: 'text-blue-600', description: 'Assign to operators' },
        { label: 'Shift Handover', path: '/shift-handover', icon: CalendarDays, color: 'text-purple-600', description: 'Manage shift transitions' },
        { label: 'Vault Guardian', path: '/vault-guardian', icon: Shield, color: 'text-amber-600', description: 'Bottle check-out/in' },
        { label: 'Manual Decant', path: '/manual-decant', icon: Beaker, color: 'text-emerald-600', description: 'Ad-hoc decanting' },
        { label: 'Operator Perf', path: '/reports/operator-performance', icon: UserCheck, color: 'text-cyan-600', description: 'Team performance' },
        { label: 'Daily Ops', path: '/reports/daily-ops', icon: ClipboardList, color: 'text-rose-600', description: 'Daily summary' },
        { label: 'Print Queue', path: '/print-queue', icon: Printer, color: 'text-zinc-600', description: 'Label printing' },
      ],
      modules: [
        { id: 'stations', name: 'Pod Operations', description: 'Monitor all pods and operator progress', icon: FlaskConical, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', path: '/ops/pod-dashboard', features: ['Pod Dashboard', 'Picking', 'Labeling', 'Decanting', 'QC & Assembly', 'Shipping'] },
        { id: 'jobs', name: 'Job Management', description: 'Create, allocate, and track jobs across the pipeline', icon: Briefcase, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', path: '/job-creation', features: ['Job Creation', 'Work Allocation', 'Shift Handover', 'Print Queue'] },
        { id: 'orders', name: 'Orders & CRM', description: 'View orders, subscriptions, and customer data', icon: ShoppingCart, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', path: '/orders/one-time', features: ['One-Time', 'Subscriptions', 'Returns', 'Customers'] },
        { id: 'reports', name: 'Reports', description: 'Operator performance, daily ops, subscription health', icon: BarChart3, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30', path: '/reports/guide', features: ['Operator Performance', 'Daily Ops', 'Subscription Health'] },
      ],
      tips: [
        'Start each day by creating jobs in Job Creation, then allocate them in Work Allocation.',
        'Use the Team Day Tracker in Work Allocation to monitor who is active, on break, or ended.',
        'Review Operator Performance weekly to identify training opportunities.',
      ],
    },

    // ── Pod Senior Member ──
    pod_senior: {
      greeting: `Hey ${userName}, ready to work?`,
      subtitle: 'Your Decanting Workstation',
      description: 'Your stations are ready. Check your assigned jobs, start your day, and work through your queue. You have access to all 6 stations — primarily S1 through S4, but you can help with fulfillment and shipping too.',
      icon: Droplets,
      accentColor: 'text-emerald-600',
      accentBg: 'from-emerald-500/10 to-teal-500/5',
      quickActions: [
        { label: 'Start My Day', path: '/ops/pod-dashboard', icon: Sun, color: 'text-gold', description: 'View jobs & start shift' },
        { label: 'Picking Ops', path: '/ops/picking', icon: ListChecks, color: 'text-blue-600', description: 'Pick items from vault' },
        { label: 'Labeling Ops', path: '/ops/labeling', icon: Package, color: 'text-purple-600', description: 'Prepare & label vials' },
        { label: 'Decanting Ops', path: '/ops/decanting', icon: Droplets, color: 'text-emerald-600', description: 'Batch decanting station' },
        { label: 'Manual Decant', path: '/manual-decant', icon: Beaker, color: 'text-amber-600', description: 'Ad-hoc decanting' },
        { label: 'Print Labels', path: '/print-queue', icon: Printer, color: 'text-zinc-600', description: 'Print label queue' },
      ],
      modules: [
        { id: 's1', name: 'Pod Dashboard', description: 'Your daily dashboard: assigned jobs, shift controls, timeline', icon: LayoutDashboard, color: 'text-gold', bgColor: 'bg-gold/10 dark:bg-gold/5', path: '/ops/pod-dashboard', features: ['My Jobs', 'Start/End Day', 'Gantt Timeline', 'Overdue Alerts'] },
        { id: 's2', name: 'Picking', description: 'Pick items from the vault for your assigned jobs', icon: ListChecks, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', path: '/ops/picking', features: ['Pick Lists', 'Request All', 'Vault Status'] },
        { id: 's3', name: 'Labeling', description: 'Prepare vials, apply labels, and stage for decanting', icon: Package, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30', path: '/ops/labeling', features: ['Prep Queue', 'Label Print', 'QC Check'] },
        { id: 's4', name: 'Decanting', description: 'Decant perfume into prepared vials in batches', icon: Droplets, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', path: '/ops/decanting', features: ['Batch Queue', 'Volume Tracking', 'QC Inspection'] },
      ],
      tips: [
        'Start your day at Pod Dashboard — it shows your assigned jobs and active pipelines.',
        'Work through stations in order: S1 → S2 → S3 → S4 for the smoothest flow.',
        'Use Manual Decant for ad-hoc requests that aren\'t part of your regular job queue.',
      ],
    },

    // ── Pod Junior Member ──
    pod_junior: {
      greeting: `Hey ${userName}, let's ship!`,
      subtitle: 'Your Fulfillment Workstation',
      description: 'Your primary focus is fulfillment and shipping (S5–S6), but you have access to all stations. Check your assigned jobs, view orders, and ensure everything ships on time.',
      icon: Package,
      accentColor: 'text-cyan-600',
      accentBg: 'from-cyan-500/10 to-blue-500/5',
      quickActions: [
        { label: 'Start My Day', path: '/ops/pod-dashboard', icon: Sun, color: 'text-gold', description: 'View jobs & start shift' },
        { label: 'QC & Assembly', path: '/ops/qc-assembly', icon: Package, color: 'text-cyan-600', description: 'Pack & fulfill orders' },
        { label: 'Shipping & Dispatch', path: '/ops/shipping', icon: Truck, color: 'text-indigo-600', description: 'Ship & track packages' },
        { label: 'Orders', path: '/orders/one-time', icon: ShoppingCart, color: 'text-blue-600', description: 'View order details' },
        { label: 'Print Labels', path: '/print-queue', icon: Printer, color: 'text-zinc-600', description: 'Print shipping labels' },
        { label: 'Decanting Ops', path: '/ops/decanting', icon: Droplets, color: 'text-emerald-600', description: 'Help with decanting' },
      ],
      modules: [
        { id: 's1', name: 'Pod Dashboard', description: 'Your daily dashboard: assigned jobs, shift controls, timeline', icon: LayoutDashboard, color: 'text-gold', bgColor: 'bg-gold/10 dark:bg-gold/5', path: '/ops/pod-dashboard', features: ['My Jobs', 'Start/End Day', 'Gantt Timeline', 'Overdue Alerts'] },
        { id: 's5', name: 'QC & Assembly', description: 'Pack orders, verify contents, prepare for shipping', icon: Package, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30', path: '/ops/qc-assembly', features: ['Pack Queue', 'Order Verification', 'QC Final Check'] },
        { id: 's6', name: 'Shipping & Dispatch', description: 'Generate shipping labels, track dispatched packages', icon: Truck, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30', path: '/ops/shipping', features: ['Ship Queue', 'Label Generation', 'Tracking', 'Manifests'] },
        { id: 'orders', name: 'Orders & CRM', description: 'View order details, customer info, and delivery status', icon: ShoppingCart, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', path: '/orders/one-time', features: ['One-Time', 'Subscriptions', 'Returns', 'Customers'] },
      ],
      tips: [
        'Start your day at Pod Dashboard to see what\'s assigned to you.',
        'Check QC & Assembly for orders ready to pack, then move to Shipping & Dispatch.',
        'Use the Orders page to look up customer details or delivery requirements.',
      ],
    },

    // ── Vault Guardian ──
    vault_guardian: {
      greeting: `Welcome, Guardian ${userName}`,
      subtitle: 'Vault Security & Inventory Control',
      description: 'You protect the vault. Manage bottle check-outs and check-ins, monitor inventory levels, handle procurement receiving, and maintain the integrity of the sealed vault.',
      icon: Shield,
      accentColor: 'text-purple-600',
      accentBg: 'from-purple-500/10 to-violet-500/5',
      quickActions: [
        { label: 'Vault Guardian', path: '/vault-guardian', icon: Shield, color: 'text-purple-600', description: 'Check-out/in bottles' },
        { label: 'Sealed Vault', path: '/inventory/sealed-vault', icon: Lock, color: 'text-amber-600', description: 'Full bottle inventory' },
        { label: 'Master Data', path: '/master/perfumes', icon: Database, color: 'text-indigo-600', description: 'Perfume registry' },
        { label: 'Purchase Orders', path: '/procurement/purchase-orders', icon: Truck, color: 'text-blue-600', description: 'Receiving & POs' },
        { label: 'Ledger', path: '/ledger', icon: FileText, color: 'text-zinc-600', description: 'Transaction records' },
        { label: 'Reconciliation', path: '/inventory/reconciliation', icon: ArrowUpDown, color: 'text-emerald-600', description: 'Stock reconciliation' },
      ],
      modules: [
        { id: 'guardian', name: 'Vault Guardian', description: 'Scan barcodes, approve check-outs, process returns', icon: Shield, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30', path: '/vault-guardian', features: ['Barcode Scan', 'Check-Out', 'Check-In', 'Return/Empty/Broken'] },
        { id: 'inventory', name: 'Inventory', description: 'Monitor sealed vault, decanting pool, packaging', icon: Warehouse, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', path: '/inventory/sealed-vault', features: ['Sealed Vault', 'Decanting Pool', 'Packaging', 'Reconciliation'] },
        { id: 'master', name: 'Master Data', description: 'Perfume registry, brands, packaging SKUs, suppliers', icon: Database, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30', path: '/master/perfumes', features: ['Perfumes', 'Brands', 'Packaging SKUs', 'Suppliers'] },
        { id: 'procurement', name: 'Procurement', description: 'Purchase orders, supplier management, receiving', icon: Truck, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', path: '/procurement/purchase-orders', features: ['Purchase Orders', 'Suppliers', 'QC Inspection'] },
      ],
      tips: [
        'Keep the Vault Guardian page open during shifts — operators will send bottle requests.',
        'Use the barcode scanner or camera for fast check-out/check-in processing.',
        'Run Stock Reconciliation at end of day to verify vault counts match records.',
      ],
    },

    // ── QC ──
    qc: {
      greeting: `Hello, ${userName}`,
      subtitle: 'Quality Control Station',
      description: 'Your focus is quality assurance — inspect batches at S4, verify fulfillment at S5, review orders, and monitor inventory quality. Every product that leaves must meet Maison Em standards.',
      icon: CheckCircle2,
      accentColor: 'text-rose-600',
      accentBg: 'from-rose-500/10 to-pink-500/5',
      quickActions: [
        { label: 'Decanting Ops QC', path: '/ops/decanting', icon: Droplets, color: 'text-emerald-600', description: 'Inspect decanted batches' },
        { label: 'QC & Assembly QC', path: '/ops/qc-assembly', icon: Package, color: 'text-cyan-600', description: 'Verify packed orders' },
        { label: 'Orders', path: '/orders/one-time', icon: ShoppingCart, color: 'text-blue-600', description: 'Review order details' },
        { label: 'Inventory', path: '/inventory/sealed-vault', icon: Warehouse, color: 'text-amber-600', description: 'Check stock quality' },
        { label: 'Daily Ops', path: '/reports/daily-ops', icon: ClipboardList, color: 'text-indigo-600', description: 'Daily operations summary' },
        { label: 'Ops Dashboard', path: '/dashboard', icon: LayoutDashboard, color: 'text-zinc-600', description: 'Operations overview' },
      ],
      modules: [
        { id: 's4', name: 'Decanting', description: 'Inspect decanted batches for quality and accuracy', icon: Droplets, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', path: '/ops/decanting', features: ['Batch Inspection', 'Volume Check', 'Quality Sign-off'] },
        { id: 's5', name: 'QC & Assembly', description: 'Final quality check before orders ship', icon: Package, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30', path: '/ops/qc-assembly', features: ['Order Verification', 'Content Check', 'QC Approval'] },
        { id: 'orders', name: 'Orders & CRM', description: 'Review orders and customer requirements', icon: ShoppingCart, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', path: '/orders/one-time', features: ['One-Time', 'Subscriptions', 'Returns'] },
        { id: 'inventory', name: 'Inventory', description: 'Monitor stock quality and levels', icon: Warehouse, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', path: '/inventory/sealed-vault', features: ['Sealed Vault', 'Decanting Pool', 'Packaging'] },
      ],
      tips: [
        'Check S4 Batch Decanting for batches awaiting QC inspection.',
        'Verify QC & Assembly orders before they move to shipping.',
        'Use the Daily Ops Report to track quality metrics and rejection rates.',
      ],
    },

    // ── Viewer ──
    viewer: {
      greeting: `Welcome, ${userName}`,
      subtitle: 'Operations Overview (Read-Only)',
      description: 'You have read-only access to key business data — orders, financial ledger, and the operations dashboard. Perfect for stakeholders who need visibility without operational access.',
      icon: Eye,
      accentColor: 'text-zinc-600',
      accentBg: 'from-zinc-500/10 to-slate-500/5',
      quickActions: [
        { label: 'Ops Dashboard', path: '/dashboard', icon: LayoutDashboard, color: 'text-blue-600', description: 'Operations overview' },
        { label: 'Orders', path: '/orders/one-time', icon: ShoppingCart, color: 'text-amber-600', description: 'View order data' },
        { label: 'Ledger', path: '/ledger', icon: FileText, color: 'text-zinc-600', description: 'Financial records' },
        { label: 'Daily Ops', path: '/reports/daily-ops', icon: ClipboardList, color: 'text-cyan-600', description: 'Daily summary' },
      ],
      modules: [
        { id: 'dashboard', name: 'Ops Dashboard', description: 'Real-time overview of operations, pipeline, and alerts', icon: LayoutDashboard, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', path: '/dashboard', features: ['KPIs', 'Pipeline', 'Alerts', 'Inventory Health'] },
        { id: 'orders', name: 'Orders & CRM', description: 'View orders, subscriptions, and customer profiles', icon: ShoppingCart, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', path: '/orders/one-time', features: ['One-Time', 'Subscriptions', 'Returns', 'Customers'] },
        { id: 'ledger', name: 'Financial Ledger', description: 'Transaction history and financial records', icon: FileText, color: 'text-zinc-600', bgColor: 'bg-zinc-50 dark:bg-zinc-900/30', path: '/ledger', features: ['Transactions', 'Cost Tracking', 'Revenue'] },
        { id: 'reports', name: 'Reports', description: 'Daily operations and subscription health reports', icon: BarChart3, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30', path: '/reports/guide', features: ['Daily Ops', 'Subscription Health'] },
      ],
      tips: [
        'Use the Ops Dashboard for a high-level view of current operations.',
        'Check the Ledger for detailed financial transaction history.',
        'The Daily Ops Report provides a comprehensive end-of-day summary.',
      ],
    },
  };

  // Admin uses the same config as owner
  configs.admin = { ...configs.owner, greeting: `Welcome back, ${userName}` };

  return configs[role] || configs.owner;
};

// ─── Helpers ─────────────────────────────────────────────────────────
function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getTimeOfDayGreeting(): { greeting: string; icon: string; period: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { greeting: 'Good morning', icon: 'sunrise', period: 'morning' };
  if (hour >= 12 && hour < 17) return { greeting: 'Good afternoon', icon: 'sun', period: 'afternoon' };
  if (hour >= 17 && hour < 21) return { greeting: 'Good evening', icon: 'sunset', period: 'evening' };
  return { greeting: 'Good night', icon: 'moon', period: 'night' };
}

function getShiftInfo(): { isOnShift: boolean; shiftLabel: string; hoursRemaining: number; overtimeWarning: boolean } {
  const now = new Date();
  const hour = now.getHours();
  // Standard shift: 9 AM - 6 PM (9 hours), OT cutoff at 8 PM
  const shiftStart = 9;
  const shiftEnd = 18;
  const otCutoff = 20;
  const isOnShift = hour >= shiftStart && hour < shiftEnd;
  const isOT = hour >= shiftEnd && hour < otCutoff;
  const hoursRemaining = isOnShift ? shiftEnd - hour : isOT ? otCutoff - hour : 0;
  return {
    isOnShift: isOnShift || isOT,
    shiftLabel: isOT ? 'Overtime' : isOnShift ? 'On Shift' : 'Off Shift',
    hoursRemaining,
    overtimeWarning: isOT || (isOnShift && shiftEnd - hour <= 1),
  };
}

// ─── Main Component ──────────────────────────────────────────
export default function WelcomeDashboard() {
  const { user, hasPermission } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const userRole = (user?.role || 'owner') as UserRole;
  const userName = user?.fullName?.split(' ')[0] || 'there';
  const config = useMemo(() => getRoleConfig(userRole, userName), [userRole, userName]);

  // Fetch live KPIs for roles that see the dashboard
  const showKPIs = ['owner', 'admin', 'pod_leader', 'system_architect', 'inventory_admin', 'qc', 'viewer'].includes(userRole);
  const { data: kpisRes } = useApiQuery(
    () => showKPIs
      ? api.dashboard.kpis({ from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })
      : Promise.resolve({ data: null }),
    [showKPIs]
  );
  const { data: alertsRes } = useApiQuery(
    () => showKPIs
      ? api.dashboard.alerts({ from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })
      : Promise.resolve({ data: [] }),
    [showKPIs]
  );
  const kpis = kpisRes as DashboardKPIs | undefined;
  const alerts = alertsRes as InventoryAlert[] | undefined;

  // Fetch recent activity
  const { data: recentActivityRes, isLoading: activityLoading } = useApiQuery(
    () => api.dashboard.recentActivity(10),
    []
  );
  const recentActivity = (recentActivityRes as ActivityEvent[] | undefined) || [];

  // Search filter
  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return config.quickActions;
    const q = searchQuery.toLowerCase();
    return config.quickActions.filter(a =>
      a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );
  }, [searchQuery, config.quickActions]);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return config.modules;
    const q = searchQuery.toLowerCase();
    return config.modules.filter(m =>
      m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) ||
      m.features.some(f => f.toLowerCase().includes(q))
    );
  }, [searchQuery, config.modules]);

  const RoleIcon = config.icon;

  // Time-of-day greeting
  const timeGreeting = useMemo(() => getTimeOfDayGreeting(), []);
  const shiftInfo = useMemo(() => getShiftInfo(), []);
  const isOperator = ['pod_senior', 'pod_junior', 'vault_guardian'].includes(userRole);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every minute
  useState(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  });

  // Build the dynamic greeting
  const dynamicGreeting = useMemo(() => {
    return `${timeGreeting.greeting}, ${userName}`;
  }, [timeGreeting.greeting, userName]);

  return (
    <div>
      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden">
        <div className={cn('absolute inset-0 bg-gradient-to-br', config.accentBg, 'via-transparent')} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold/3 rounded-full blur-3xl" />

        <div className="relative px-6 pt-8 pb-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center border',
                  config.accentColor === 'text-gold'
                    ? 'from-gold/20 to-gold/5 border-gold/20'
                    : 'from-current/10 to-current/5 border-current/10',
                  config.accentColor.replace('text-', 'border-').replace('600', '200'),
                )}>
                  <RoleIcon className={cn('w-6 h-6', config.accentColor)} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {dynamicGreeting}
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      {config.subtitle}
                      <Badge variant="outline" className="text-[9px] font-normal">
                        {userRole.replace(/_/g, ' ')}
                      </Badge>
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shift Info — only for operator roles */}
              {isOperator && (
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border',
                    shiftInfo.isOnShift
                      ? shiftInfo.overtimeWarning
                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-200/50 dark:border-amber-800/30'
                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-200/50 dark:border-emerald-800/30'
                      : 'bg-muted text-muted-foreground border-border',
                  )}>
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      shiftInfo.isOnShift
                        ? shiftInfo.overtimeWarning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
                        : 'bg-muted-foreground/40',
                    )} />
                    {shiftInfo.shiftLabel}
                  </div>
                  {shiftInfo.isOnShift && shiftInfo.hoursRemaining > 0 && (
                    <span className={cn(
                      'text-[10px] font-medium',
                      shiftInfo.overtimeWarning ? 'text-amber-600' : 'text-muted-foreground',
                    )}>
                      <Timer className="w-3 h-3 inline mr-0.5" />
                      {shiftInfo.hoursRemaining}h remaining{shiftInfo.overtimeWarning ? ' (OT cutoff approaching)' : ''}
                    </span>
                  )}
                  {!shiftInfo.isOnShift && (
                    <span className="text-[10px] text-muted-foreground">Shift starts at 9:00 AM</span>
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {config.description}
              </p>
            </div>

            {/* Live Status — only for dashboard-viewing roles */}
            {showKPIs && kpis && (
              <div className="hidden lg:flex items-center gap-3">
                <div className="flex items-center gap-4 bg-card/80 backdrop-blur-sm rounded-xl border px-4 py-3">
                  <div className="text-center">
                    <p className="text-lg font-bold font-mono">{kpis.one_time_orders.new + kpis.one_time_orders.in_progress}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Active Orders</p>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="text-center">
                    <p className="text-lg font-bold font-mono">{kpis.decant_batches.in_progress}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Batches</p>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="text-center">
                    <p className="text-lg font-bold font-mono">{kpis.shipping.ready_for_pickup}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Ready Ship</p>
                  </div>
                  {alerts && alerts.length > 0 && (
                    <>
                      <div className="w-px h-8 bg-border" />
                      <div className="text-center">
                        <p className="text-lg font-bold font-mono text-destructive">{alerts.length}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Alerts</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="mt-5 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search your actions and modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/80 backdrop-blur-sm border-border/50 focus:border-gold/50"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* ── Quick Actions ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold" /> Quick Actions
            </h2>
            {showKPIs && (
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Full Dashboard <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            )}
          </div>
          <div className={cn(
            'grid gap-2',
            filteredActions.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8',
          )}>
            {filteredActions.map(action => {
              const Icon = action.icon;
              return (
                <Link key={action.path} href={action.path}>
                  <Card className="border hover:border-gold/30 hover:shadow-sm transition-all cursor-pointer group h-full">
                    <CardContent className="p-3 text-center">
                      <Icon className={cn('w-5 h-5 mx-auto mb-1.5 transition-transform group-hover:scale-110', action.color)} />
                      <p className="text-xs font-medium leading-tight">{action.label}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5 hidden sm:block">{action.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Your Modules ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Your Modules
            </h2>
            <Badge variant="outline" className="text-[10px]">{config.modules.length} modules</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredModules.map(mod => {
              const Icon = mod.icon;
              return (
                <Link key={mod.id} href={mod.path}>
                  <Card className="border hover:border-gold/30 hover:shadow-md transition-all cursor-pointer group h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', mod.bgColor)}>
                          <Icon className={cn('w-4.5 h-4.5', mod.color)} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold">{mod.name}</h3>
                          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{mod.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {mod.features.slice(0, 4).map(f => (
                          <Badge key={f} variant="secondary" className="text-[9px] font-normal">{f}</Badge>
                        ))}
                        {mod.features.length > 4 && (
                          <Badge variant="secondary" className="text-[9px] font-normal">+{mod.features.length - 4}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Recent Activity
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {recentActivity.length} events
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded w-1/3" />
                      <div className="h-2.5 bg-muted rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.slice(0, 8).map((event) => {
                  const IconMap: Record<string, React.ElementType> = {
                    Package, Wine, Droplets, ShoppingCart, Briefcase, Truck, Activity,
                  };
                  const Icon = IconMap[event.icon] || Activity;
                  return (
                    <div key={event.id} className="flex items-start gap-2.5 py-2 hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors">
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                        event.color.includes('emerald') ? 'bg-emerald-50 dark:bg-emerald-950/30' :
                        event.color.includes('amber') ? 'bg-amber-50 dark:bg-amber-950/30' :
                        event.color.includes('blue') ? 'bg-blue-50 dark:bg-blue-950/30' :
                        event.color.includes('indigo') ? 'bg-indigo-50 dark:bg-indigo-950/30' :
                        event.color.includes('purple') ? 'bg-purple-50 dark:bg-purple-950/30' :
                        event.color.includes('gold') ? 'bg-gold/10' :
                        'bg-muted',
                      )}>
                        <Icon className={cn('w-3.5 h-3.5', event.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-foreground">{event.title}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimeAgo(event.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed truncate">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No recent activity yet</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Events will appear here as you use the system</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Tips for Your Role ── */}
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-gold" />
              Tips for Your Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {config.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/20">
                  <div className="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-gold">{i + 1}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Onboarding Progress — only for owner/admin/system_architect ── */}
        {['owner', 'admin', 'system_architect'].includes(userRole) && (
          <Card className="border-gold/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-gold" />
                  System Setup Progress
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">3/7 complete</span>
                  <Badge variant="outline" className="text-[10px]">43%</Badge>
                </div>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-gold to-gold/70 rounded-full transition-all duration-500" style={{ width: '43%' }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { step: 1, title: 'Set Up Master Data', path: '/guides/master-data', icon: Database, done: true },
                { step: 2, title: 'Configure BOM Templates', path: '/bom/boms-creation', icon: Puzzle, done: true },
                { step: 3, title: 'Define End Products', path: '/bom/end-products', icon: Package, done: true },
                { step: 4, title: 'Set Up Inventory', path: '/guides/inventory', icon: Warehouse, done: false },
                { step: 5, title: 'Configure Stations', path: '/guides/decanting', icon: Factory, done: false },
                { step: 6, title: 'Assign User Roles', path: '/guides/user-access', icon: Users, done: false },
                { step: 7, title: 'Run First Order', path: '/ops/pod-dashboard', icon: Play, done: false },
              ].map(step => {
                const Icon = step.icon;
                return (
                  <Link key={step.step} href={step.path}>
                    <div className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer',
                      step.done ? 'bg-emerald-50/50 dark:bg-emerald-950/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/20' : 'hover:bg-muted/30',
                    )}>
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                        step.done ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-muted text-muted-foreground',
                      )}>
                        {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.step}
                      </div>
                      <p className={cn('text-sm font-medium flex-1', step.done && 'text-emerald-700 dark:text-emerald-400')}>
                        {step.title}
                      </p>
                      <Icon className={cn('w-4 h-4 shrink-0', step.done ? 'text-emerald-500' : 'text-muted-foreground/40')} />
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── System Info Footer ── */}
        <Card className="border-dashed bg-muted/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground">System Online</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground font-mono">v0.1.0</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground">
                    Logged in as <strong className="text-foreground">{user?.fullName || 'Owner'}</strong>
                    <Badge variant="outline" className="ml-1.5 text-[8px]">{userRole.replace(/_/g, ' ')}</Badge>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showKPIs && (
                  <Link href="/dashboard">
                    <Button variant="outline" size="sm" className="text-xs gap-1 border-gold/30 text-gold hover:bg-gold/5">
                      <BarChart3 className="w-3 h-3" /> Operations Dashboard
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
