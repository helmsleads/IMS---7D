const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findDuplicates() {
  const { data, error } = await supabase
    .from('products')
    .select('sku, id, name, client_id')
    .order('sku');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  // Group by SKU (case-insensitive)
  const skuMap = {};
  for (const p of data) {
    const sku = p.sku ? p.sku.toLowerCase() : null;
    if (sku) {
      if (!skuMap[sku]) skuMap[sku] = [];
      skuMap[sku].push(p);
    }
  }

  // Find duplicates
  const duplicates = Object.entries(skuMap).filter(([k, v]) => v.length > 1);

  if (duplicates.length === 0) {
    console.log('No duplicate SKUs found.');
    console.log('Total products:', data.length);
  } else {
    console.log('DUPLICATE SKUs FOUND:\n');
    duplicates.forEach(([sku, products]) => {
      console.log('SKU:', sku);
      products.forEach(p => console.log('  -', p.id, '|', p.name, '| client:', p.client_id));
      console.log('');
    });
  }
}

findDuplicates();
