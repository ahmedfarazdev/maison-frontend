// ============================================================
// Supplier Spend Report — Analytics dashboard for PO spend
// Uses real confirmed PO data from the database
// ============================================================

import { PageHeader } from '@/components/shared';
import { SupplierSpendChart } from '@/components/SupplierSpendChart';
import { DollarSign } from 'lucide-react';

export default function SupplierSpendReport() {
  return (
    <div>
      <PageHeader
        title="Supplier Spend Analytics"
        subtitle="Track procurement spend by supplier and over time"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Supplier Spend' }]}
      />
      <div className="p-6">
        <SupplierSpendChart />
      </div>
    </div>
  );
}
