import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import { Loader2 } from "lucide-react";

// ---- Page imports (Lazy Loaded) ----
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Station0 = lazy(() => import("./pages/stations/Station0"));
const Station1 = lazy(() => import("./pages/stations/Station1"));
const Station2 = lazy(() => import("./pages/stations/Station2"));
const Station3 = lazy(() => import("./pages/stations/Station3"));
const Station4 = lazy(() => import("./pages/stations/Station4"));
const Station5 = lazy(() => import("./pages/stations/Station5"));
const Station6 = lazy(() => import("./pages/stations/Station6"));
const ManualDecant = lazy(() => import("./pages/ManualDecant"));
const CreateProducts = lazy(() => import("./pages/production/CreateProducts"));
const ProductionJobs = lazy(() => import("./pages/production/ProductionJobs"));
const ProductionManagement = lazy(() => import("./pages/production/ProductionManagement"));
const OneTimeOrderProduction = lazy(() => import("./pages/production/OneTimeOrderProduction"));
const SubscriptionCycleProduction = lazy(() => import("./pages/production/SubscriptionCycleProduction"));
const JobBoard = lazy(() => import("./pages/jobs/JobBoard"));
const DayTracker = lazy(() => import("./pages/DayTracker"));
const VaultGuardian = lazy(() => import("./pages/VaultGuardian"));
// Deprecated: WorkAllocation, ShiftHandover, JobCreation — redirected to /ops/*
const OrderGrouping = lazy(() => import("./pages/OrderGrouping"));
const OperatorPerformance = lazy(() => import("./pages/OperatorPerformance"));
const OneTimeOrders = lazy(() => import("./pages/orders/OneTimeOrders"));
const Subscriptions = lazy(() => import("./pages/orders/Subscriptions"));
const PerfumeOfTheMonth = lazy(() => import("./pages/PerfumeOfTheMonth"));
const SealedVault = lazy(() => import("./pages/inventory/SealedVault"));
const DecantingPool = lazy(() => import("./pages/inventory/DecantingPool"));
const PackagingInventory = lazy(() => import("./pages/inventory/PackagingInventory"));
const StockReconciliation = lazy(() => import("./pages/inventory/StockReconciliation"));
const PerfumeMaster = lazy(() => import("./pages/master/PerfumeMaster"));
const BrandsPage = lazy(() => import("./pages/master/BrandsPage"));
const AuraDefinitions = lazy(() => import("./pages/master/MasterDataPages").then(m => ({ default: m.AuraDefinitions })));
const FragranceFamilies = lazy(() => import("./pages/master/MasterDataPages").then(m => ({ default: m.FragranceFamilies })));
const FiltersAndTags = lazy(() => import("./pages/master/MasterDataPages").then(m => ({ default: m.FiltersAndTags })));
const PricingRules = lazy(() => import("./pages/master/MasterDataPages").then(m => ({ default: m.PricingRules })));

const VaultLocationsPage = lazy(() => import("./pages/master/VaultLocationsPage"));
const SuppliersFullPage = lazy(() => import("./pages/master/SuppliersPage"));
const SyringesRegistryPage = lazy(() => import("./pages/master/SyringesRegistryPage"));
const PackagingSKUsPage = lazy(() => import("./pages/master/PackagingSKUsPage"));
const SupplierAnalyticsPage = lazy(() => import("./pages/master/SupplierAnalyticsPage"));
const Ledger = lazy(() => import("./pages/Ledger"));
const InventoryCostReport = lazy(() => import("./pages/reports/InventoryCostReport"));
const SupplierSpendReport = lazy(() => import("./pages/reports/SupplierSpendReport"));
const PackagingCostReport = lazy(() => import("./pages/reports/PackagingCostReport"));
const UnifiedProcurementReport = lazy(() => import("./pages/reports/UnifiedProcurementReport"));
const MarginAnalysisReport = lazy(() => import("./pages/reports/MarginAnalysisReport"));
const PurchaseOrders = lazy(() => import("./pages/procurement/PurchaseOrders"));
const QuickPO = lazy(() => import("./pages/procurement/QuickPO"));
const Settings = lazy(() => import("./pages/Settings"));
const PrintQueue = lazy(() => import("./pages/PrintQueue"));
const CustomerProfiles = lazy(() => import("./pages/crm/CustomerProfiles"));
const DailyOpsReport = lazy(() => import("./pages/reports/DailyOpsReport"));
const Returns = lazy(() => import("./pages/orders/Returns"));
const Exchanges = lazy(() => import("./pages/orders/Exchanges"));
const ProductPnL = lazy(() => import("./pages/reports/ProductPnL"));
const SubscriptionHealth = lazy(() => import("./pages/crm/SubscriptionHealth"));
const PromoCodes = lazy(() => import("./pages/crm/PromoCodes"));
const InvoiceGenerator = lazy(() => import("./pages/reports/InvoiceGenerator"));
const BOMSetup = lazy(() => import("./pages/bom/BOMSetup"));
const EndProducts = lazy(() => import("./pages/bom/EndProducts"));
const BOMsCreation = lazy(() => import("./pages/bom/BOMsCreation"));
const ComponentLibrary = lazy(() => import("./pages/bom/ComponentLibrary"));
const OrderMapping = lazy(() => import("./pages/bom/OrderMapping"));
const InventoryImpact = lazy(() => import("./pages/bom/InventoryImpact"));
const SetupGuide = lazy(() => import("./pages/bom/SetupGuide"));
const DecantingGuide = lazy(() => import("./pages/guides/DecantingGuide"));
const InventoryGuide = lazy(() => import("./pages/guides/InventoryGuide"));
const ProcurementGuide = lazy(() => import("./pages/guides/ProcurementGuide"));
const MasterDataGuide = lazy(() => import("./pages/guides/MasterDataGuide"));
const UserAccessGuide = lazy(() => import("./pages/guides/UserAccessGuide"));
const OperationsGuide = lazy(() => import("./pages/guides/OperationsGuide"));
const ProductsGuide = lazy(() => import("./pages/guides/ProductsGuide"));
const OrdersGuide = lazy(() => import("./pages/guides/OrdersGuide"));
const BOMPricingReport = lazy(() => import("./pages/reports/BOMPricingReport"));
const RevenueComparison = lazy(() => import("./pages/reports/RevenueComparison"));
const ReportsGuide = lazy(() => import("./pages/reports/ReportsGuide"));
const WelcomeDashboard = lazy(() => import("./pages/WelcomeDashboard"));
const Capsules = lazy(() => import("./pages/capsules/Capsules"));
const CapsulePerformance = lazy(() => import("./pages/capsules/CapsulePerformance"));
const EmVault = lazy(() => import("./pages/em-vault/EmVault"));
const EmVaultAccess = lazy(() => import("./pages/em-vault/EmVaultAccess"));
const Gifting = lazy(() => import("./pages/gifting/Gifting"));
const GiftSubscriptions = lazy(() => import("./pages/gifting/GiftSubscriptions"));
const GiftSets = lazy(() => import("./pages/gifting/GiftSets"));
const GiftCards = lazy(() => import("./pages/gifting/GiftCards"));
const CorporateGifting = lazy(() => import("./pages/gifting/CorporateGifting"));
const GiftSetPerformance = lazy(() => import("./pages/gifting/GiftSetPerformance"));
const DemandPlanning = lazy(() => import("./pages/subscriptions/DemandPlanning"));
const PerfumeForecast = lazy(() => import("./pages/subscriptions/PerfumeForecast"));
const SellThroughReport = lazy(() => import("./pages/reports/SellThroughReport"));
const NotesLibrary = lazy(() => import("./pages/master/NotesLibrary"));
const OrderDefinitions = lazy(() => import("./pages/setup/OrderDefinitions"));
const SubscriptionPricingSetup = lazy(() => import("./pages/setup/SubscriptionPricingSetup"));
const OperationsConfig = lazy(() => import("./pages/setup/OperationsConfig"));
const OperationalDefaults = lazy(() => import("./pages/setup/OperationalDefaults"));
const RTSFinance = lazy(() => import("./pages/inventory/RTSFinance"));
const RTSLedger = lazy(() => import("./pages/inventory/RTSLedger"));
const PodDashboard = lazy(() => import("./pages/ops/PodDashboard"));
const ProductionQueue = lazy(() => import("./pages/ops/ProductionQueue"));
const FulfillmentQueue = lazy(() => import("./pages/ops/FulfillmentQueue"));
const MasterDashboard = lazy(() => import("./pages/ops/MasterDashboard"));
const JobLedger = lazy(() => import("./pages/ops/JobLedger"));
const AuraKeyProcessing = lazy(() => import("./pages/orders/AuraKeyProcessing"));
const ReadyProductFulfillment = lazy(() => import("./pages/orders/ReadyProductFulfillment"));
const JobAllocation = lazy(() => import("./pages/jobs/JobAllocation"));
const Fulfillment = lazy(() => import("./pages/fulfillment/Fulfillment"));
const Shipping = lazy(() => import("./pages/fulfillment/Shipping"));
const ShippingLedger = lazy(() => import("./pages/fulfillment/ShippingLedger"));
const ReadyToShipModule = lazy(() => import("./pages/ready-to-ship/ReadyToShipModule"));
const SubscriptionCyclesModule = lazy(() => import("./pages/subscription-cycles/SubscriptionCyclesModule"));
const OneTimeOrdersModule = lazy(() => import("./pages/one-time-orders/OneTimeOrdersModule"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
import { useAuth } from "./contexts/AuthContext";

function ProtectedRoute({ children, requiredPermission }: { children: React.ReactNode; requiredPermission?: string }) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Redirect to="/404" />;
  }

  return <>{children}</>;
}

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 gap-4">
    <Loader2 className="w-10 h-10 text-white animate-spin opacity-50" />
    <p className="text-zinc-500 text-sm font-medium animate-pulse">Loading Maison Em OS...</p>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Switch>
        <Route path="/login" component={Login} />

        {/* Auth Guard for all other routes */}
        <Route>
          {() => (
            <ProtectedRoute>
              <Switch>
                <Route path="/"><Redirect to="/welcome" /></Route>

                  {/* All pages wrapped in AppLayout */}
                  <Route path="/welcome">{() => <AppLayout><WelcomeDashboard /></AppLayout>}</Route>
                  <Route path="/dashboard">{() => <AppLayout><Dashboard /></AppLayout>}</Route>

          {/* Station 0 — shared */}
          <Route path="/stations/0-stock-register">{() => <AppLayout><Station0 /></AppLayout>}</Route>

          {/* ═══════════════════════════════════════════════════ */}
          {/* PRODUCTION PLANNING (legacy routes still accessible) */}
          {/* ═══════════════════════════════════════════════════ */}
          <Route path="/ready-to-ship">{() => <AppLayout><ReadyToShipModule /></AppLayout>}</Route>
          <Route path="/ready-to-ship/create"><Redirect to="/ready-to-ship" /></Route>
          <Route path="/ready-to-ship/jobs">{() => <AppLayout><ProductionJobs /></AppLayout>}</Route>
          <Route path="/ready-to-ship/rts-finance">{() => <AppLayout><RTSFinance /></AppLayout>}</Route>
          <Route path="/ready-to-ship/rts-ledger">{() => <AppLayout><RTSLedger /></AppLayout>}</Route>
          <Route path="/subscription-cycles">{() => <AppLayout><SubscriptionCyclesModule /></AppLayout>}</Route>
          <Route path="/one-time-orders">{() => <AppLayout><OneTimeOrdersModule /></AppLayout>}</Route>

          {/* Legacy redirects for old production paths */}
          <Route path="/production/management"><Redirect to="/ready-to-ship" /></Route>
          <Route path="/production/create"><Redirect to="/ready-to-ship/create" /></Route>
          <Route path="/production/jobs"><Redirect to="/ready-to-ship/jobs" /></Route>
          <Route path="/production/one-time"><Redirect to="/one-time-orders" /></Route>
          <Route path="/production/subscription"><Redirect to="/subscription-cycles" /></Route>

          {/* ═══════════════════════════════════════════════════ */}
          {/* OPERATIONS — Pod Architecture */}
          {/* ═══════════════════════════════════════════════════ */}
          <Route path="/ops/pod-dashboard">{() => <AppLayout><PodDashboard /></AppLayout>}</Route>
          <Route path="/ops/production-queue">{() => <AppLayout><ProductionQueue /></AppLayout>}</Route>
          <Route path="/ops/fulfillment-queue">{() => <AppLayout><FulfillmentQueue /></AppLayout>}</Route>
          <Route path="/ops/master-dashboard">{() => <AppLayout><MasterDashboard /></AppLayout>}</Route>
          <Route path="/ops/job-allocation">{() => <AppLayout><JobAllocation /></AppLayout>}</Route>
          <Route path="/ops/job-ledger">{() => <AppLayout><JobLedger /></AppLayout>}</Route>

          {/* Legacy redirects for removed pages */}
          <Route path="/ops/order-grouping">{() => <AppLayout><OrderGrouping /></AppLayout>}</Route>
          <Route path="/order-grouping"><Redirect to="/ops/order-grouping" /></Route>
          <Route path="/jobs/allocation"><Redirect to="/ops/job-allocation" /></Route>
          <Route path="/jobs/team-assignments"><Redirect to="/ops/pod-dashboard" /></Route>
          <Route path="/jobs/station-assignments"><Redirect to="/ops/pod-dashboard" /></Route>

          {/* ═══════════════════════════════════════════════════ */}
          {/* POD FRAMEWORK — Station Ops (no S-numbers) */}
          {/* ═══════════════════════════════════════════════════ */}
          <Route path="/ops/picking">{() => <AppLayout><Station2 /></AppLayout>}</Route>
          <Route path="/ops/labeling">{() => <AppLayout><Station3 /></AppLayout>}</Route>
          <Route path="/ops/decanting">{() => <AppLayout><Station4 /></AppLayout>}</Route>
          <Route path="/ops/qc-assembly">{() => <AppLayout><Station5 /></AppLayout>}</Route>
          <Route path="/ops/shipping">{() => <AppLayout><Shipping /></AppLayout>}</Route>

          {/* Legacy S-number station path redirects */}
          <Route path="/stations/1-job-board"><Redirect to="/ops/pod-dashboard" /></Route>
          <Route path="/stations/2-picking"><Redirect to="/ops/picking" /></Route>
          <Route path="/stations/3-labeling"><Redirect to="/ops/labeling" /></Route>
          <Route path="/stations/4-decanting"><Redirect to="/ops/decanting" /></Route>
          <Route path="/stations/5-qc-assembly"><Redirect to="/ops/qc-assembly" /></Route>
          <Route path="/stations/6-shipping-dispatch"><Redirect to="/ops/shipping" /></Route>
          <Route path="/stations/3-prep-label"><Redirect to="/ops/labeling" /></Route>
          <Route path="/stations/4-batch-decant"><Redirect to="/ops/decanting" /></Route>
          <Route path="/stations/5-fulfillment"><Redirect to="/ops/qc-assembly" /></Route>
          <Route path="/stations/6-shipping"><Redirect to="/ops/shipping" /></Route>
          <Route path="/stations/6-final-check"><Redirect to="/ops/shipping" /></Route>
          <Route path="/stations/picking"><Redirect to="/ops/picking" /></Route>
          <Route path="/stations/labeling"><Redirect to="/ops/labeling" /></Route>
          <Route path="/stations/decanting"><Redirect to="/ops/decanting" /></Route>
          <Route path="/stations/qc-assembly"><Redirect to="/ops/qc-assembly" /></Route>
          <Route path="/stations/shipping-dispatch"><Redirect to="/ops/shipping" /></Route>

          <Route path="/manual-decant">{() => <AppLayout><ManualDecant /></AppLayout>}</Route>

          <Route path="/day-tracker">{() => <AppLayout><DayTracker /></AppLayout>}</Route>
          <Route path="/vault-guardian">{() => <AppLayout><VaultGuardian /></AppLayout>}</Route>
          {/* Legacy redirects for deprecated ops pages */}
          <Route path="/task-tracker"><Redirect to="/ops/pod-dashboard" /></Route>
          <Route path="/job-creation"><Redirect to="/ops/job-allocation" /></Route>
          <Route path="/work-allocation"><Redirect to="/ops/pod-dashboard" /></Route>
          <Route path="/shift-handover"><Redirect to="/ops/pod-dashboard" /></Route>
          <Route path="/operator-performance"><Redirect to="/reports/operator-performance" /></Route>
          <Route path="/reports/operator-performance">{() => <AppLayout><OperatorPerformance /></AppLayout>}</Route>

          {/* Orders / CRM */}
          <Route path="/orders/one-time">{() => <AppLayout><OneTimeOrders /></AppLayout>}</Route>
          <Route path="/orders/subscriptions">{() => <AppLayout><Subscriptions /></AppLayout>}</Route>
          <Route path="/orders/potm">{() => <AppLayout><PerfumeOfTheMonth /></AppLayout>}</Route>
          <Route path="/orders/customers">{() => <AppLayout><CustomerProfiles /></AppLayout>}</Route>
          <Route path="/orders/returns">{() => <AppLayout><Returns /></AppLayout>}</Route>
          <Route path="/orders/exchanges">{() => <AppLayout><Exchanges /></AppLayout>}</Route>
          <Route path="/orders/aura-key">{() => <AppLayout><AuraKeyProcessing /></AppLayout>}</Route>
          <Route path="/orders/ready-products">{() => <AppLayout><ReadyProductFulfillment /></AppLayout>}</Route>

          {/* CRM */}
          <Route path="/crm/customers">{() => <AppLayout><CustomerProfiles /></AppLayout>}</Route>
          <Route path="/crm/subscription-health">{() => <AppLayout><SubscriptionHealth /></AppLayout>}</Route>
          <Route path="/crm/promo-codes">{() => <AppLayout><PromoCodes /></AppLayout>}</Route>
          <Route path="/orders/subscription-health"><Redirect to="/reports/subscription-health" /></Route>
          <Route path="/reports/invoices">{() => <AppLayout><InvoiceGenerator /></AppLayout>}</Route>

          {/* Inventory (Ready-to-Ship route is first match above) */}
          <Route path="/inventory/sealed-vault">{() => <AppLayout><SealedVault /></AppLayout>}</Route>
          <Route path="/inventory/decanting-pool">{() => <AppLayout><DecantingPool /></AppLayout>}</Route>
          <Route path="/inventory/packaging">{() => <AppLayout><PackagingInventory /></AppLayout>}</Route>
          <Route path="/inventory/reconciliation">{() => <AppLayout><StockReconciliation /></AppLayout>}</Route>

          {/* Master Data */}
          <Route path="/master/perfumes">{() => <ProtectedRoute requiredPermission="master_data.read"><AppLayout><PerfumeMaster /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/master/brands">{() => <ProtectedRoute requiredPermission="master_data.read"><AppLayout><BrandsPage /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/master/auras">{() => <AppLayout><AuraDefinitions /></AppLayout>}</Route>
          <Route path="/master/families">{() => <AppLayout><FragranceFamilies /></AppLayout>}</Route>
          <Route path="/master/filters">{() => <AppLayout><FiltersAndTags /></AppLayout>}</Route>
          <Route path="/master/pricing">{() => <AppLayout><PricingRules /></AppLayout>}</Route>
          <Route path="/master/locations">{() => <AppLayout><VaultLocationsPage /></AppLayout>}</Route>
          <Route path="/master/suppliers">{() => <AppLayout><SuppliersFullPage /></AppLayout>}</Route>
          <Route path="/master/syringes">{() => <AppLayout><SyringesRegistryPage /></AppLayout>}</Route>
          <Route path="/master/packaging-skus">{() => <AppLayout><PackagingSKUsPage /></AppLayout>}</Route>
          <Route path="/master/supplier-analytics"><Redirect to="/reports/supplier-analytics" /></Route>
          <Route path="/reports/supplier-analytics">{() => <AppLayout><SupplierAnalyticsPage /></AppLayout>}</Route>

          {/* Capsules */}
          <Route path="/capsules">{() => <AppLayout><Capsules /></AppLayout>}</Route>
          <Route path="/capsules/performance">{() => <AppLayout><CapsulePerformance /></AppLayout>}</Route>

          {/* Em Vault */}
          <Route path="/em-vault">{() => <AppLayout><EmVault /></AppLayout>}</Route>
          <Route path="/em-vault/access">{() => <AppLayout><EmVaultAccess /></AppLayout>}</Route>

          {/* Subscription Management */}
          <Route path="/subscriptions/cycles">{() => <AppLayout><Subscriptions /></AppLayout>}</Route>
          <Route path="/subscriptions/forecast">{() => <AppLayout><PerfumeForecast /></AppLayout>}</Route>
          <Route path="/subscriptions/demand">{() => <AppLayout><DemandPlanning /></AppLayout>}</Route>
          <Route path="/subscriptions/active-cycle">{() => <AppLayout><SubscriptionCycleProduction /></AppLayout>}</Route>
          <Route path="/subscriptions/cycle-history">{() => <AppLayout><SubscriptionCyclesModule /></AppLayout>}</Route>

          {/* Gifting */}
          <Route path="/gifting">{() => <AppLayout><Gifting /></AppLayout>}</Route>
          <Route path="/gifting/subscriptions">{() => <AppLayout><GiftSubscriptions /></AppLayout>}</Route>
          <Route path="/gifting/sets">{() => <AppLayout><GiftSets /></AppLayout>}</Route>
          <Route path="/gifting/cards">{() => <AppLayout><GiftCards /></AppLayout>}</Route>
          <Route path="/gifting/corporate">{() => <AppLayout><CorporateGifting /></AppLayout>}</Route>
          <Route path="/gifting/performance">{() => <AppLayout><GiftSetPerformance /></AppLayout>}</Route>

          {/* Ledger */}
          <Route path="/ledger">{() => <AppLayout><Ledger /></AppLayout>}</Route>
          <Route path="/ledger/timeline">{() => <AppLayout><Ledger defaultTab="timeline" /></AppLayout>}</Route>
          <Route path="/ledger/bottle">{() => <AppLayout><Ledger defaultTab="bottle" /></AppLayout>}</Route>
          <Route path="/ledger/decant">{() => <AppLayout><Ledger defaultTab="decant" /></AppLayout>}</Route>
          <Route path="/ledger/purchase">{() => <AppLayout><Ledger defaultTab="purchase" /></AppLayout>}</Route>
          <Route path="/ledger/shipping">{() => <AppLayout><ShippingLedger /></AppLayout>}</Route>

          {/* Procurement */}
          <Route path="/procurement/purchase-orders">{() => <ProtectedRoute requiredPermission="procurement.read"><AppLayout><PurchaseOrders /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/procurement/quick-po">{() => <ProtectedRoute requiredPermission="procurement.read"><AppLayout><QuickPO /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/procurement/packaging-pos"><Redirect to="/procurement/purchase-orders" /></Route>

          {/* Reports */}
          <Route path="/reports/guide">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><ReportsGuide /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/cost">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><InventoryCostReport /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/supplier-spend">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><SupplierSpendReport /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/packaging-cost">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><PackagingCostReport /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/procurement">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><UnifiedProcurementReport /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/margin-analysis">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><MarginAnalysisReport /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/daily-ops">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><DailyOpsReport /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/product-pnl">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><ProductPnL /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/subscription-health">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><SubscriptionHealth /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/bom-pricing">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><BOMPricingReport /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/revenue-comparison">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><RevenueComparison /></AppLayout></ProtectedRoute>}</Route>
          <Route path="/reports/sell-through">{() => <ProtectedRoute requiredPermission="reports.read"><AppLayout><SellThroughReport /></AppLayout></ProtectedRoute>}</Route>

          {/* BOM */}
          <Route path="/bom/end-products">{() => <AppLayout><EndProducts /></AppLayout>}</Route>
          <Route path="/bom/boms-creation">{() => <AppLayout><BOMsCreation /></AppLayout>}</Route>
          <Route path="/bom/setup"><Redirect to="/bom/end-products" /></Route>
          <Route path="/bom/components">{() => <AppLayout><ComponentLibrary /></AppLayout>}</Route>
          <Route path="/bom/order-mapping">{() => <AppLayout><OrderMapping /></AppLayout>}</Route>
          <Route path="/bom/inventory-impact">{() => <AppLayout><InventoryImpact /></AppLayout>}</Route>
          <Route path="/bom/guide">{() => <AppLayout><SetupGuide /></AppLayout>}</Route>

          {/* Setup Guides */}
          <Route path="/guides/user-access">{() => <AppLayout><UserAccessGuide /></AppLayout>}</Route>
          <Route path="/guides/decanting">{() => <AppLayout><DecantingGuide /></AppLayout>}</Route>
          <Route path="/guides/inventory">{() => <AppLayout><InventoryGuide /></AppLayout>}</Route>
          <Route path="/guides/procurement">{() => <AppLayout><ProcurementGuide /></AppLayout>}</Route>
          <Route path="/guides/master-data">{() => <AppLayout><MasterDataGuide /></AppLayout>}</Route>
          <Route path="/guides/operations">{() => <AppLayout><OperationsGuide /></AppLayout>}</Route>
          <Route path="/guides/products">{() => <AppLayout><ProductsGuide /></AppLayout>}</Route>
          <Route path="/guides/orders">{() => <AppLayout><OrdersGuide /></AppLayout>}</Route>

          {/* System Setup */}
          <Route path="/system-setup/order-definitions">{() => <AppLayout><OrderDefinitions /></AppLayout>}</Route>
          <Route path="/system-setup/operations">{() => <AppLayout><OperationsConfig /></AppLayout>}</Route>
          <Route path="/system-setup/operational-defaults">{() => <AppLayout><OperationalDefaults /></AppLayout>}</Route>
          <Route path="/system-setup/fragrance-families"><Redirect to="/master/families" /></Route>
          <Route path="/system-setup/filters-tags"><Redirect to="/master/filters" /></Route>
          <Route path="/system-setup/pricing-rules"><Redirect to="/master/pricing" /></Route>
          <Route path="/system-setup/subscription-pricing">{() => <AppLayout><SubscriptionPricingSetup /></AppLayout>}</Route>
          <Route path="/system-setup/notes-library">{() => <AppLayout><NotesLibrary /></AppLayout>}</Route>

          {/* Operations */}
          <Route path="/print-queue">{() => <AppLayout><PrintQueue /></AppLayout>}</Route>

          {/* Settings */}
          <Route path="/settings">{() => <AppLayout><Settings /></AppLayout>}</Route>

          {/* 404 */}
          <Route path="/404" component={NotFound} />
          <Route>{() => <AppLayout><NotFound /></AppLayout>}</Route>
              </Switch>
            </ProtectedRoute>
          )}
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <AuthProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
