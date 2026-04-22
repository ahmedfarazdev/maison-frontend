// ============================================================
// Global Search — ⌘K / Ctrl+K Command Palette
// Searches across orders, perfumes, customers, bottles, POs,
// jobs, and pages. Grouped results with type-ahead.
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import {
  ShoppingCart, Droplets, Package, Users, ClipboardList,
  LayoutDashboard, Settings, Beaker, Factory, BookOpen,
  Database, BarChart3, Truck, Box, Pipette, MapPin,
  Search, Sparkles, RotateCcw, Warehouse, CheckSquare,
  Building2, Tag, Shield, PackageOpen, DollarSign, Percent,
  TrendingUp, Layers, FlaskConical, Printer, ScanBarcode,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import type { Order, Perfume, Supplier, SealedBottle, Job } from '@/types';

// ---- Page navigation items ----
interface PageItem {
  label: string;
  path: string;
  icon: React.ElementType;
  keywords: string[];
}

const PAGES: PageItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, keywords: ['home', 'overview', 'kpi'] },
  { label: 'One-Time Orders', path: '/orders/one-time', icon: ShoppingCart, keywords: ['orders', 'sales'] },
  { label: 'Subscriptions', path: '/orders/subscriptions', icon: RotateCcw, keywords: ['subscription', 'cycle', 'recurring'] },
  { label: 'Perfume of the Month', path: '/orders/potm', icon: Sparkles, keywords: ['potm', 'monthly', 'selection'] },
  { label: 'Stock Registry', path: '/stations/0-stock-register', icon: Warehouse, keywords: ['intake', 'register', 'stock'] },
  { label: 'Bottle Inventory', path: '/inventory/sealed-vault', icon: Box, keywords: ['sealed', 'bottles', 'inventory'] },
  { label: 'Decanting Pool', path: '/inventory/decanting-pool', icon: Droplets, keywords: ['decant', 'pool', 'liquid'] },
  { label: 'Packaging & Materials', path: '/inventory/packaging', icon: PackageOpen, keywords: ['packaging', 'materials'] },
  { label: 'Stock Reconciliation', path: '/inventory/reconciliation', icon: CheckSquare, keywords: ['reconciliation', 'count'] },
  { label: 'Perfume Master', path: '/master/perfumes', icon: BookOpen, keywords: ['perfume', 'master', 'catalog'] },
  { label: 'Brands', path: '/master/brands', icon: Building2, keywords: ['brand', 'house'] },
  { label: 'Aura Definitions', path: '/master/auras', icon: Layers, keywords: ['aura', 'color', 'energy'] },
  { label: 'Fragrance Families', path: '/master/families', icon: Tag, keywords: ['family', 'fragrance'] },
  { label: 'Filters & Tags', path: '/master/filters', icon: Shield, keywords: ['filter', 'tag'] },
  { label: 'Pricing Rules', path: '/master/pricing', icon: Tag, keywords: ['pricing', 'surcharge', 'discount'] },
  { label: 'Vault Locations', path: '/master/locations', icon: MapPin, keywords: ['vault', 'location', 'shelf'] },
  { label: 'Syringes Registry', path: '/master/syringes', icon: Pipette, keywords: ['syringe', 'tool'] },
  { label: 'Packaging SKUs', path: '/master/packaging-skus', icon: PackageOpen, keywords: ['sku', 'packaging'] },
  { label: 'Purchase Orders', path: '/procurement/purchase-orders', icon: ClipboardList, keywords: ['po', 'purchase', 'procurement'] },
  { label: 'Suppliers', path: '/master/suppliers', icon: Users, keywords: ['supplier', 'vendor'] },
  { label: 'Ledger', path: '/ledger', icon: BookOpen, keywords: ['ledger', 'history', 'events'] },
  { label: 'Inventory Cost Report', path: '/reports/cost', icon: DollarSign, keywords: ['cost', 'report', 'cogs'] },
  { label: 'Supplier Analytics', path: '/reports/supplier-analytics', icon: Layers, keywords: ['analytics', 'supplier'] },
  { label: 'Procurement COGS', path: '/reports/procurement', icon: TrendingUp, keywords: ['procurement', 'cogs'] },
  { label: 'Margin Analysis', path: '/reports/margin-analysis', icon: Percent, keywords: ['margin', 'profit'] },
  { label: 'Manual Decant', path: '/manual-decant', icon: Beaker, keywords: ['manual', 'decant', 'custom'] },
  { label: 'Settings', path: '/settings', icon: Settings, keywords: ['settings', 'config', 'preferences'] },
  // Pod Operations (unified)
  { label: 'Pod Dashboard', path: '/ops/pod-dashboard', icon: ClipboardList, keywords: ['station', 'job', 'board', 's1'] },
  { label: 'Picking Ops', path: '/ops/picking', icon: ScanBarcode, keywords: ['station', 'picking', 's2'] },
  { label: 'Labeling Ops', path: '/ops/labeling', icon: Printer, keywords: ['station', 'label', 'prep', 's3'] },
  { label: 'Decanting Ops', path: '/ops/decanting', icon: FlaskConical, keywords: ['station', 'decant', 'batch', 's4'] },
  { label: 'QC & Assembly Ops', path: '/ops/qc-assembly', icon: CheckSquare, keywords: ['station', 'fulfillment', 'pack', 's5'] },
  { label: 'Shipping & Dispatch', path: '/ops/shipping', icon: Truck, keywords: ['station', 'shipping', 'ship', 's6'] },
  { label: 'Job Creation', path: '/job-creation', icon: ClipboardList, keywords: ['job', 'create', 'new'] },
];

// ---- Search result types ----
interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  path: string;
  category: 'order' | 'perfume' | 'customer' | 'bottle' | 'supplier' | 'job' | 'page';
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [, setLocation] = useLocation();

  // Cached data for searching
  const [orders, setOrders] = useState<Order[]>([]);
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bottles, setBottles] = useState<SealedBottle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Load data when dialog opens
  useEffect(() => {
    if (!open || dataLoaded) return;
    const load = async () => {
      try {
        const [ordersRes, perfumesRes, suppliersRes, bottlesRes, jobsRes] = await Promise.allSettled([
          api.orders.list(),
          api.master.perfumes(),
          api.master.suppliers(),
          api.inventory.sealedBottles(),
          api.jobs.list(),
        ]);
        if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value.data);
        if (perfumesRes.status === 'fulfilled') setPerfumes((perfumesRes.value.data || []) as Perfume[]);
        if (suppliersRes.status === 'fulfilled') setSuppliers(suppliersRes.value.data);
        if (bottlesRes.status === 'fulfilled') setBottles(bottlesRes.value.data);
        if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.data);
        setDataLoaded(true);
      } catch {
        // Silently fail — search will still work for pages
        setDataLoaded(true);
      }
    };
    load();
  }, [open, dataLoaded]);

  const navigate = useCallback((path: string) => {
    setOpen(false);
    setQuery('');
    setLocation(path);
  }, [setLocation]);

  // Build search results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return { pages: PAGES.slice(0, 8), data: [] };

    // Filter pages
    const matchedPages = PAGES.filter(p =>
      p.label.toLowerCase().includes(q) ||
      p.keywords.some(k => k.includes(q))
    );

    const dataResults: SearchResult[] = [];

    // Search orders
    orders.forEach(o => {
      const match = o.order_id.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.email.toLowerCase().includes(q) ||
        o.items.some(i => i.perfume_name.toLowerCase().includes(q));
      if (match) {
        dataResults.push({
          id: o.order_id,
          label: o.order_id,
          sublabel: `${o.customer.name} · ${o.status} · AED ${o.total_amount}`,
          icon: ShoppingCart,
          path: '/orders/one-time',
          category: 'order',
        });
      }
    });

    // Search perfumes
    perfumes.forEach(p => {
      const match = p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.master_id.toLowerCase().includes(q);
      if (match) {
        dataResults.push({
          id: p.master_id,
          label: `${p.brand} — ${p.name}`,
          sublabel: `${p.concentration} · ${p.aura_color} · ${p.reference_size_ml}ml`,
          icon: Droplets,
          path: '/master/perfumes',
          category: 'perfume',
        });
      }
    });

    // Search customers (extracted from orders)
    const seenCustomers = new Set<string>();
    orders.forEach(o => {
      const cName = o.customer.name.toLowerCase();
      const cEmail = o.customer.email.toLowerCase();
      if ((cName.includes(q) || cEmail.includes(q)) && !seenCustomers.has(cEmail)) {
        seenCustomers.add(cEmail);
        dataResults.push({
          id: `cust-${cEmail}`,
          label: o.customer.name,
          sublabel: `${o.customer.email} · ${o.customer.city}, ${o.customer.country}`,
          icon: Users,
          path: '/orders/one-time',
          category: 'customer',
        });
      }
    });

    // Search bottles
    bottles.forEach(b => {
      const match = b.bottle_id.toLowerCase().includes(q) ||
        b.manufacturer_id.toLowerCase().includes(q) ||
        (b.barcode && b.barcode.toLowerCase().includes(q));
      if (match) {
        dataResults.push({
          id: b.bottle_id,
          label: b.bottle_id,
          sublabel: `${b.bottle_type} · ${b.size_ml}ml · ${b.status} · ${b.location_code}`,
          icon: Package,
          path: '/inventory/sealed-vault',
          category: 'bottle',
        });
      }
    });

    // Search suppliers
    suppliers.forEach(s => {
      const match = s.name.toLowerCase().includes(q) ||
        s.contact_email.toLowerCase().includes(q) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(q));
      if (match) {
        dataResults.push({
          id: s.supplier_id,
          label: s.name,
          sublabel: `${s.type} · ${s.country} · ${s.active ? 'Active' : 'Inactive'}`,
          icon: Users,
          path: '/master/suppliers',
          category: 'supplier',
        });
      }
    });

    // Search jobs
    jobs.forEach(j => {
      const match = j.job_id.toLowerCase().includes(q) ||
        j.type.toLowerCase().includes(q) ||
        j.source.toLowerCase().includes(q);
      if (match) {
        dataResults.push({
          id: j.job_id,
          label: j.job_id,
          sublabel: `${j.type} · ${j.source} · ${j.status}`,
          icon: Factory,
          path: '/ops/pod-dashboard',
          category: 'job',
        });
      }
    });

    return { pages: matchedPages, data: dataResults.slice(0, 20) };
  }, [query, orders, perfumes, suppliers, bottles, jobs]);

  // Group data results by category
  const groupedData = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    results.data.forEach(r => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, [results.data]);

  const categoryLabels: Record<string, string> = {
    order: 'Orders',
    perfume: 'Perfumes',
    customer: 'Customers',
    bottle: 'Bottles',
    supplier: 'Suppliers',
    job: 'Jobs',
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Global Search"
      description="Search orders, perfumes, customers, bottles, and more"
    >
      <CommandInput
        placeholder="Search orders, perfumes, customers, pages..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4">
            <Search className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results found</p>
            <p className="text-xs text-muted-foreground/60">Try a different search term</p>
          </div>
        </CommandEmpty>

        {/* Data results */}
        {Object.entries(groupedData).map(([category, items]) => (
          <CommandGroup key={category} heading={categoryLabels[category] || category}>
            {items.map(item => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.sublabel}`}
                  onSelect={() => navigate(item.path)}
                  className="gap-3 py-2.5"
                >
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}

        {/* Separator between data and pages */}
        {results.data.length > 0 && results.pages.length > 0 && <CommandSeparator />}

        {/* Page navigation */}
        {results.pages.length > 0 && (
          <CommandGroup heading="Pages">
            {results.pages.map(page => {
              const Icon = page.icon;
              return (
                <CommandItem
                  key={page.path}
                  value={`${page.label} ${page.keywords.join(' ')}`}
                  onSelect={() => navigate(page.path)}
                  className="gap-3 py-2"
                >
                  <div className="w-7 h-7 rounded-md bg-accent/50 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-accent-foreground" />
                  </div>
                  <span className="text-sm">{page.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
