const fs = require('fs');

let b = fs.readFileSync('src/pages/reports/BOMPricingReport.tsx', 'utf8');
b = b.replace(/bomCost/g, 'bom_cost').replace(/sellingPrice/g, 'selling_price').replace(/marginPercent/g, 'margin_percent');
fs.writeFileSync('src/pages/reports/BOMPricingReport.tsx', b);

let p = fs.readFileSync('src/pages/reports/PackagingCostReport.tsx', 'utf8');
p = p.replace(/totalSpent/g, 'total_spent').replace(/avgUnitCost/g, 'avg_unit_cost');
fs.writeFileSync('src/pages/reports/PackagingCostReport.tsx', p);

let u = fs.readFileSync('src/pages/reports/UnifiedProcurementReport.tsx', 'utf8');
u = u.replace(/totalSpent/g, 'total_spent').replace(/avgOrder/g, 'avg_order');
fs.writeFileSync('src/pages/reports/UnifiedProcurementReport.tsx', u);

console.log('Fixed reports');
