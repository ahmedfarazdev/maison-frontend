const fs = require('fs');
let file = 'src/lib/api-client.ts';
let code = fs.readFileSync(file, 'utf8');

if(!code.includes('signIn:')) {
  code = code.replace(/me:\s*async\s*\(\)\s*=>\s*\{\s*try\s*\{\s*return\s*wrapOne\(await apiGet\('\/auth\/me'\)\);\s*\}\s*catch\s*\{\s*return\s*wrapOne\(null\);\s*\}\s*\}/, \me: async () => { try { return wrapOne(await apiGet('/auth/me')); } catch { return wrapOne(null); } }, signIn: async (a,b) => {}, signOut: async () => {}\);
}
if(!code.includes('notes:')) {
  code = code.replace(/master:\s*\{/, \master: { notes: async () => wrapList([]), notesPerfumes: async () => wrapList([]), \);
}
if(!code.includes('tags: {')) {
  code = code.replace(/mutations:\s*\{/, \mutations: { tags: { create: async (d) => apiPost('/tags', d), update: async (id,d) => apiPut(\/tags/\\, d), delete: async (id) => apiDelete(\/tags/\\) }, locations: { create: async (d) => apiPost('/locations', d), update: async (id,d) => apiPut(\/locations/\\, d), delete: async (id) => apiDelete(\/locations/\\) }, syringes: { create: async (d) => apiPost('/syringes', d), update: async (id,d) => apiPut(\/syringes/\\, d), delete: async (id) => apiDelete(\/syringes/\\) }, purchaseOrders: { create: async (d) => apiPost('/po', d), update: async (id,d) => apiPut(\/po/\\, d), delete: async (id) => apiDelete(\/po/\\) }, taxonomies: { auras: { create: async (d) => apiPost('/ma', d), update: async (id,d) => apiPut(\/ma/\\, d), delete: async (id) => apiDelete(\/ma/\\) }, families: { create: async (d) => apiPost('/fa', d), update: async (id,d) => apiPut(\/fa/\\, d), delete: async (id) => apiDelete(\/fa/\\) }, subFamilies: { create: async (d) => apiPost('/sa', d), update: async (id,d) => apiPut(\/sa/\\, d), delete: async (id) => apiDelete(\/sa/\\) } }, \);
}
fs.writeFileSync(file, code);

