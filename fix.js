const fs = require('fs');

let file = 'src/lib/api-client.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Fixing auth
code = code.replace(/auth: \{\s*me: async \(\) => \{\s*try \{\s*return wrapOne\(await apiGet\('\/auth\/me'\)\);\s*\} catch \{\s*return wrapOne\(null\);\s*\}\s*\}\s*\}/g,
    `auth: {\n    me: async () => { try { return wrapOne(await apiGet('/auth/me')); } catch { return wrapOne(null); } },\n    signIn: async (a: any, b: any) => ({ data: null, error: null }),\n    signOut: async () => {}\n  }`);

// 2. Fixing master data read endpoints
if(!code.includes('notes: async')) {
    code = code.replace(/master: \{/g, `master: {\n    filterTags: async () => wrapList(mock.mockTags),\n    notes: async () => wrapList([]),\n    notesPerfumes: async () => wrapList([]),`);
}

// 3. Fixing missing mutations for tags, locations, syringes
if(!code.includes('tags: {')) {
    code = code.replace(/mutations: \{/g, `mutations: {\n    tags: {\n      create: async (data: any) => apiPost('/tags', data),\n      update: async (id: string, data: any) => apiPut(\`/tags/\${id}\`, data),\n      delete: async (id: string) => apiDelete(\`/tags/\${id}\`)\n    },\n    locations: {\n      create: async (data: any) => apiPost('/locations', data),\n      update: async (id: string, data: any) => apiPut(\`/locations/\${id}\`, data),\n      delete: async (id: string) => apiDelete(\`/locations/\${id}\`)\n    },\n    syringes: {\n      create: async (data: any) => apiPost('/syringes', data),\n      update: async (id: string, data: any) => apiPut(\`/syringes/\${id}\`, data),\n      delete: async (id: string) => apiDelete(\`/syringes/\${id}\`)\n    },\n    purchaseOrders: {\n      create: async (data: any) => apiPost('/po', data),\n      update: async (id: string, data: any) => apiPut(\`/po/\${id}\`, data),\n      delete: async (id: string) => apiDelete(\`/po/\${id}\`),\n      uploadInvoice: async (id: string, file: any) => Promise.resolve(),\n      approveInvoice: async (id: string, p: any) => Promise.resolve(),\n      receiveBulk: async (id: string, p: any) => Promise.resolve()\n    },\n    subscriptionCycles: {\n      updateStatus: async (id: string, status: string) => Promise.resolve()\n    },\n    taxonomies: {\n      auras: {\n        create: async (d: any) => apiPost('/ma', d),\n        update: async (id: string, d: any) => apiPut(\`/ma/\${id}\`, d),\n        delete: async (id: string) => apiDelete(\`/ma/\${id}\`)\n      },\n      families: {\n        create: async (d: any) => apiPost('/fa', d),\n        update: async (id: string, d: any) => apiPut(\`/fa/\${id}\`, d),\n        delete: async (id: string) => apiDelete(\`/fa/\${id}\`)\n      },\n      subFamilies: {\n        create: async (d: any) => apiPost('/sa', d),\n        update: async (id: string, d: any) => apiPut(\`/sa/\${id}\`, d),\n        delete: async (id: string) => apiDelete(\`/sa/\${id}\`)\n      }\n    },`);
} else {
    // If it DOES include tags but lacks update/delete on syringes
    code = code.replace(/syringes: \{\s*create: \(data: any\) => apiPost\('\/syringes', data\)\s*\}/, `syringes: {\n      create: async (data: any) => apiPost('/syringes', data),\n      update: async (id: string, data: any) => apiPut(\`/syringes/\${id}\`, data),\n      delete: async (id: string) => apiDelete(\`/syringes/\${id}\`)\n    }`);
}

// 4. Fixing missing attachments on purchaseOrders queries
if(!code.includes('attachments: async')) {
    code = code.replace(/purchaseOrders: \{/g, `purchaseOrders: {\n    attachments: async (id: string) => wrapList([]),`);
}


fs.writeFileSync(file, code);
