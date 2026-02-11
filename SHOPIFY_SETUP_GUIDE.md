# Shopify Integration Setup Guide

> **For beginners** - This guide assumes no prior experience with Shopify APIs or OAuth.
> Follow each step exactly. Do not skip ahead.

---

## Table of Contents

1. [Step 1: Create Shopify Partner Account](#step-1-create-shopify-partner-account)
2. [Step 2: Create a Development Store](#step-2-create-a-development-store)
3. [Step 3: Create a Shopify App](#step-3-create-a-shopify-app)
4. [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
5. [Step 5: Set Up Local Webhook Testing](#step-5-set-up-local-webhook-testing)
6. [Step 6: Run Database Migrations](#step-6-run-database-migrations)
7. [Step 7: Implement the Code](#step-7-implement-the-code)
8. [Step 8: Test the Integration](#step-8-test-the-integration)

---

## Step 1: Create Shopify Partner Account

**Time needed: 5 minutes**

### 1.1 Go to Shopify Partners

Open your browser and go to:
```
https://partners.shopify.com
```

### 1.2 Click "Join now" (it's free)

You'll see a page like this:
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│        Become a Shopify Partner                             │
│                                                             │
│   Build apps, create themes, or refer merchants to          │
│   earn recurring income.                                    │
│                                                             │
│                    [Join now - it's free]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Fill out the registration form

Enter:
- Email address (use your business email)
- Password
- Business name: "7 Degrees Co" (or your company name)
- Business type: Select "Building apps or integrations"

### 1.4 Verify your email

Check your inbox for a verification email from Shopify. Click the link.

### 1.5 Complete your partner profile

You'll be asked some questions:
- What do you want to do? → Select "Build apps"
- What's your experience level? → Select whatever applies

### ✅ Verification

You should now see the Shopify Partner Dashboard:
```
┌─────────────────────────────────────────────────────────────┐
│  SHOPIFY PARTNERS                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Welcome to Shopify Partners!                               │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Stores  │  │   Apps   │  │ Services │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Write down your Partner Account email - you'll need it later.**

---

## Step 2: Create a Development Store

**Time needed: 3 minutes**

A development store is a free Shopify store for testing. It has no transaction limits and doesn't require payment.

### 2.1 From Partner Dashboard, click "Stores"

In the left sidebar, click "Stores"

### 2.2 Click "Add store"

You'll see options:
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  What type of store do you want to create?                  │
│                                                             │
│  ○ Development store                                        │
│    Create a free store to test your apps and themes         │
│                                                             │
│  ○ Managed store                                            │
│    Transfer to a client                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Select **"Development store"**

### 2.3 Fill in store details

- **Store name**: `7degrees-test` (or similar - this will be your-name.myshopify.com)
- **Store purpose**: Select "Create a store to test and build"
- **Store type**: Leave as default

### 2.4 Click "Create development store"

Wait 30-60 seconds for the store to be created.

### ✅ Verification

You should see your new store in the list:
```
┌─────────────────────────────────────────────────────────────┐
│  Your stores                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  7degrees-test.myshopify.com          Development store     │
│  Created just now                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Write down your store URL**: `____________.myshopify.com`

### 2.5 Add test products to your store

Click on your store to open it, then:

1. In Shopify Admin, go to **Products** in the left sidebar
2. Click **"Add product"**
3. Create 2-3 test products:

**Product 1:**
```
Title: Test Widget Blue
Price: $19.99
SKU: TEST-WIDGET-BLU
Inventory: 100 units
```

**Product 2:**
```
Title: Test Widget Red
Price: $24.99
SKU: TEST-WIDGET-RED
Inventory: 50 units
```

**Product 3:**
```
Title: Test Gadget
Price: $49.99
SKU: TEST-GADGET-001
Inventory: 25 units
```

### ✅ Verification

Go to Products in your Shopify admin. You should see your test products listed.

---

## Step 3: Create a Shopify App

**Time needed: 10 minutes**

This creates the credentials your IMS will use to connect to Shopify.

### 3.1 Go back to Partner Dashboard

Click "Partners" logo in top-left, or go to:
```
https://partners.shopify.com
```

### 3.2 Click "Apps" in the sidebar

### 3.3 Click "Create app"

You'll see options:
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Create a new app                                           │
│                                                             │
│  ○ Create app manually                                      │
│    Configure your app settings yourself                     │
│                                                             │
│  ○ Use Shopify CLI                                          │
│    For developers who want to use command line              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Select **"Create app manually"**

### 3.4 Enter app information

```
App name: 7D IMS Integration
App URL: https://localhost:3000  (we'll change this later)
```

Click **"Create"**

### 3.5 Get your API credentials

After creating, you'll be on the app page. Click **"Configuration"** tab.

You'll see:
```
┌─────────────────────────────────────────────────────────────┐
│  Client credentials                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client ID                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1a2b3c4d5e6f7g8h9i0j                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Client secret                     [Generate secret]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 Generate Client Secret

Click **"Generate secret"**

⚠️ **IMPORTANT**: Copy and save this secret immediately! You won't be able to see it again.

```
┌─────────────────────────────────────────────────────────────┐
│  Client secret                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠️ This secret will only be shown once. Copy it now!       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Write down these credentials:**

```
Client ID:     _________________________________

Client Secret: _________________________________
```

### 3.7 Configure App URLs

Still in Configuration, scroll down to find **"URLs"** section.

Click **"Edit"** and enter:

```
App URL:                    https://localhost:3000
Allowed redirection URLs:   https://localhost:3000/api/integrations/shopify/callback
```

⚠️ We'll update these with your real domain or ngrok URL later.

### 3.8 Configure API Scopes

Scroll down to **"API access scopes"** or go to **"API access"** tab.

Click **"Configure"** and select these scopes:

```
✅ read_orders          - View orders
✅ write_orders         - Update orders (for fulfillment)
✅ read_products        - View products for mapping
✅ write_products       - (optional) Update products
✅ read_inventory       - View inventory levels
✅ write_inventory      - Update inventory levels
✅ read_fulfillments    - View fulfillment status
✅ write_fulfillments   - Create fulfillments (send tracking)
✅ read_locations       - View warehouse locations
```

Click **"Save"**

### ✅ Verification

Your app configuration should show:
- Client ID: Visible
- Client secret: (hidden, but you saved it)
- Scopes: List of permissions
- Redirect URL: Your callback URL

---

## Step 4: Configure Environment Variables

**Time needed: 5 minutes**

### 4.1 Open your project's .env.local file

In your IMS project, open or create `.env.local`:

```bash
# Windows - use File Explorer or:
notepad "C:\Users\18cla\IMS - 7D\.env.local"
```

### 4.2 Add Shopify credentials

Add these lines to your `.env.local`:

```env
# Existing variables (don't delete these)
NEXT_PUBLIC_SUPABASE_URL=https://qqxbhgwhrgdacekrlxzq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_existing_key
RESEND_API_KEY=your_existing_key

# ===== NEW: Shopify Integration =====

# From Step 3.6 - Your Shopify App credentials
SHOPIFY_CLIENT_ID=your_client_id_here
SHOPIFY_CLIENT_SECRET=your_client_secret_here

# The permissions your app requests
SHOPIFY_SCOPES=read_orders,write_orders,read_products,read_inventory,write_inventory,read_fulfillments,write_fulfillments,read_locations

# Your app's public URL (we'll set this properly in Step 5)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# For encrypting OAuth tokens (generate a random 32-byte hex string)
# You can generate one at: https://generate-random.org/api-key-generator
TOKEN_ENCRYPTION_KEY=your_64_character_hex_string_here

# Supabase Service Role Key (for webhook processing)
# Get this from: Supabase Dashboard > Settings > API > service_role key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 4.3 Generate TOKEN_ENCRYPTION_KEY

Open this URL in your browser:
```
https://generate-random.org/api-key-generator?count=1&length=64&type=hex
```

Or run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the result and paste it as `TOKEN_ENCRYPTION_KEY`.

### 4.4 Get Supabase Service Role Key

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** (gear icon) > **API**
4. Find **"service_role key"** (NOT the anon key)
5. Click "Reveal" and copy it

⚠️ **SECURITY WARNING**: The service_role key bypasses Row Level Security. Never expose it in client-side code or commit it to git.

### 4.5 Configure Upstash (for rate limiting and scheduled jobs)

**Upstash provides:**
- **Redis** - Distributed rate limiting across serverless functions
- **QStash** - Scheduled jobs (inventory sync)

1. Go to [Upstash Console](https://console.upstash.com)
2. Create a free account
3. Create a new Redis database:
   - Name: `ims-rate-limit`
   - Region: Choose closest to your deployment
4. Copy the REST URL and Token to your `.env.local`:

```env
# Upstash Redis (for distributed rate limiting)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

5. For scheduled jobs, generate a secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env.local`:
```env
# Scheduled Jobs Secret
CRON_SECRET=your_generated_secret_here
```

### 4.6 Set up Scheduled Inventory Sync (QStash)

1. In Upstash Console, go to **QStash**
2. Create a new schedule:
   - **URL:** `https://your-app.com/api/cron/sync-shopify-inventory`
   - **Method:** POST
   - **Schedule:** `0 * * * *` (every hour)
   - **Headers:** Add `Authorization: Bearer <your-CRON_SECRET>`

This will automatically sync inventory from IMS to Shopify every hour.

### ✅ Verification

Your `.env.local` should have these Shopify-related variables:
```
SHOPIFY_CLIENT_ID=✓
SHOPIFY_CLIENT_SECRET=✓
SHOPIFY_SCOPES=✓
NEXT_PUBLIC_APP_URL=✓
TOKEN_ENCRYPTION_KEY=✓
SUPABASE_SERVICE_ROLE_KEY=✓
UPSTASH_REDIS_REST_URL=✓
UPSTASH_REDIS_REST_TOKEN=✓
CRON_SECRET=✓
```

---

## Step 5: Set Up Local Webhook Testing

**Time needed: 10 minutes**

Shopify needs to send webhooks to your server. During development, your localhost isn't accessible from the internet. We use **ngrok** to create a tunnel.

### 5.1 Install ngrok

**Option A: Using npm (easiest)**
```bash
npm install -g ngrok
```

**Option B: Download from website**
1. Go to: https://ngrok.com/download
2. Download for Windows
3. Extract and add to your PATH

### 5.2 Create a free ngrok account

1. Go to: https://ngrok.com
2. Click "Sign up" (free)
3. After signup, go to: https://dashboard.ngrok.com/get-started/your-authtoken
4. Copy your authtoken

### 5.3 Configure ngrok with your authtoken

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### 5.4 Start your Next.js development server

Open a terminal in your project folder:
```bash
cd "C:\Users\18cla\IMS - 7D"
npm run dev
```

You should see:
```
   ▲ Next.js 16.1.1
   - Local:        http://localhost:3000
   - Environments: .env.local

 ✓ Ready in 2.3s
```

**Keep this terminal open!**

### 5.5 Start ngrok tunnel

Open a **NEW** terminal window (keep the first one running):
```bash
ngrok http 3000
```

You'll see something like:
```
ngrok

Session Status                online
Account                       your-email@example.com (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123xyz.ngrok-free.app -> http://localhost:3000
```

### 5.6 Copy your ngrok URL

Find the `Forwarding` line that shows `https://`:
```
https://abc123xyz.ngrok-free.app
```

**Write down your ngrok URL**: `https://________________________.ngrok-free.app`

⚠️ **Note**: This URL changes every time you restart ngrok (unless you have a paid plan).

### 5.7 Update environment variable

Open `.env.local` and update:
```env
NEXT_PUBLIC_APP_URL=https://abc123xyz.ngrok-free.app
```

Replace with YOUR actual ngrok URL.

### 5.8 Update Shopify App URLs

Go back to your Shopify Partner Dashboard:
1. Go to **Apps** > Click your app
2. Go to **Configuration**
3. Update the URLs:

```
App URL:                    https://abc123xyz.ngrok-free.app
Allowed redirection URLs:   https://abc123xyz.ngrok-free.app/api/integrations/shopify/callback
```

Click **"Save"**

### 5.9 Restart your Next.js server

Go to the terminal running `npm run dev`, press `Ctrl+C` to stop it, then:
```bash
npm run dev
```

### ✅ Verification

1. Open your ngrok URL in browser: `https://abc123xyz.ngrok-free.app`
2. You should see your IMS application (same as localhost:3000)
3. Check ngrok terminal - you should see the request logged

---

## Step 6: Run Database Migrations

**Time needed: 15 minutes**

Now we'll create the database tables needed for Shopify integration.

### 6.1 Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**

### 6.2 Run Migration 1: Client Integrations Table

Copy and paste this ENTIRE SQL block, then click **"Run"**:

```sql
-- Migration 1: Client Integrations Table
-- Run this in Supabase SQL Editor

-- Create enum types
DO $$ BEGIN
    CREATE TYPE integration_platform AS ENUM ('shopify', 'tiktok', 'amazon', 'ebay', 'woocommerce');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE integration_status AS ENUM ('pending', 'active', 'paused', 'error', 'disconnected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create client_integrations table
CREATE TABLE IF NOT EXISTS client_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  platform integration_platform NOT NULL,

  -- Shopify-specific
  shop_domain VARCHAR(255),
  shop_name VARCHAR(255),

  -- OAuth tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,

  -- Webhook configuration
  webhook_secret TEXT,
  webhooks_registered BOOLEAN DEFAULT false,

  -- Sync configuration
  settings JSONB DEFAULT '{
    "auto_import_orders": true,
    "auto_sync_inventory": true,
    "sync_inventory_interval_minutes": 60,
    "inventory_buffer": 0,
    "default_location_id": null,
    "fulfillment_notify_customer": true
  }'::jsonb,

  -- Status tracking
  status integration_status DEFAULT 'pending',
  status_message TEXT,
  last_order_sync_at TIMESTAMPTZ,
  last_inventory_sync_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  UNIQUE(client_id, platform, shop_domain)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_integrations_client ON client_integrations(client_id);
CREATE INDEX IF NOT EXISTS idx_client_integrations_status ON client_integrations(status);

-- Enable RLS
ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Clients can view own integrations" ON client_integrations;
CREATE POLICY "Clients can view own integrations"
  ON client_integrations FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
    OR
    client_id IN (
      SELECT id FROM clients WHERE auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Client admins can manage integrations" ON client_integrations;
CREATE POLICY "Client admins can manage integrations"
  ON client_integrations FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM client_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Staff can manage all integrations" ON client_integrations;
CREATE POLICY "Staff can manage all integrations"
  ON client_integrations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND active = true)
  );

-- Success message
SELECT 'Migration 1 completed: client_integrations table created' as result;
```

You should see:
```
result
------
Migration 1 completed: client_integrations table created
```

### 6.3 Run Migration 2: Product Mappings Table

Click **"New query"**, paste this, and click **"Run"**:

```sql
-- Migration 2: Product Mappings Table

CREATE TABLE IF NOT EXISTS product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES client_integrations(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,

  -- External identifiers
  external_product_id VARCHAR(255) NOT NULL,
  external_variant_id VARCHAR(255),
  external_sku VARCHAR(255),
  external_barcode VARCHAR(255),
  external_inventory_item_id VARCHAR(255),

  -- Sync settings
  sync_inventory BOOLEAN DEFAULT true,
  sync_price BOOLEAN DEFAULT false,

  -- Metadata
  external_title VARCHAR(500),
  external_image_url TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(integration_id, external_variant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_mappings_integration ON product_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_product ON product_mappings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_external ON product_mappings(external_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_sku ON product_mappings(external_sku);

-- Enable RLS
ALTER TABLE product_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Users can view mappings for their integrations" ON product_mappings;
CREATE POLICY "Users can view mappings for their integrations"
  ON product_mappings FOR ALL
  USING (
    integration_id IN (
      SELECT id FROM client_integrations WHERE client_id IN (
        SELECT client_id FROM client_users WHERE user_id = auth.uid()
        UNION
        SELECT id FROM clients WHERE auth_id = auth.uid()
      )
    )
    OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND active = true)
  );

SELECT 'Migration 2 completed: product_mappings table created' as result;
```

### 6.4 Run Migration 3: Webhook Events Table

Click **"New query"**, paste this, and click **"Run"**:

```sql
-- Migration 3: Webhook Events Table

DO $$ BEGIN
    CREATE TYPE webhook_status AS ENUM ('received', 'processing', 'processed', 'failed', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES client_integrations(id) ON DELETE SET NULL,

  -- Event identification
  platform integration_platform NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255),

  -- Payload
  payload JSONB NOT NULL,
  headers JSONB,

  -- Processing status
  status webhook_status DEFAULT 'received',
  error_message TEXT,
  retry_count INT DEFAULT 0,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  UNIQUE(platform, event_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status, received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_integration ON webhook_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- No RLS for webhook_events - accessed via service role only

SELECT 'Migration 3 completed: webhook_events table created' as result;
```

### 6.5 Run Migration 4: Extend Outbound Orders

Click **"New query"**, paste this, and click **"Run"**:

```sql
-- Migration 4: Extend Outbound Orders for Shopify

-- Add columns if they don't exist
DO $$
BEGIN
    -- Add external_order_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'outbound_orders' AND column_name = 'external_order_id') THEN
        ALTER TABLE outbound_orders ADD COLUMN external_order_id VARCHAR(255);
    END IF;

    -- Add external_platform column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'outbound_orders' AND column_name = 'external_platform') THEN
        ALTER TABLE outbound_orders ADD COLUMN external_platform VARCHAR(50);
    END IF;

    -- Add external_order_number column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'outbound_orders' AND column_name = 'external_order_number') THEN
        ALTER TABLE outbound_orders ADD COLUMN external_order_number VARCHAR(100);
    END IF;

    -- Add integration_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'outbound_orders' AND column_name = 'integration_id') THEN
        ALTER TABLE outbound_orders ADD COLUMN integration_id UUID REFERENCES client_integrations(id);
    END IF;
END $$;

-- Create index for external order lookups
CREATE INDEX IF NOT EXISTS idx_outbound_orders_external
  ON outbound_orders(external_platform, external_order_id);

SELECT 'Migration 4 completed: outbound_orders extended' as result;
```

### ✅ Verification

Run this query to verify all tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('client_integrations', 'product_mappings', 'webhook_events');
```

You should see:
```
table_name
----------
client_integrations
product_mappings
webhook_events
```

Also verify the outbound_orders columns:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'outbound_orders'
AND column_name LIKE 'external%' OR column_name = 'integration_id';
```

---

## Step 7: Implement the Code

**Time needed: 30-45 minutes**

Now we'll create all the necessary code files. I'll create each file for you.

### Ready to Proceed?

Before continuing, confirm you have:

- [ ] Shopify Partner account created (Step 1)
- [ ] Development store created with test products (Step 2)
- [ ] Shopify App created with Client ID and Secret (Step 3)
- [ ] Environment variables configured (Step 4)
- [ ] ngrok running and URLs updated (Step 5)
- [ ] Database migrations completed (Step 6)

**If all checkboxes are complete, tell me "Ready for Step 7" and I'll create all the code files.**

---

## Step 8: Test the Integration

After code is implemented, follow this testing sequence:

### 8.1 Test OAuth Flow

1. Log into client portal
2. Go to Settings > Integrations
3. Click "Connect Shopify"
4. Enter your dev store name (without .myshopify.com)
5. Click Connect
6. Authorize the app in Shopify
7. Verify redirect back to portal with success message

### 8.2 Test Product Mapping

1. Go to Shopify Products page in integration settings
2. Click "Refresh from Shopify"
3. Verify your test products appear
4. Map them to IMS products

### 8.3 Test Order Import

1. Go to your Shopify dev store admin
2. Create a test order (Orders > Create order)
3. Wait 30 seconds
4. Check IMS - order should appear

### 8.4 Test Fulfillment Sync

1. Find the imported order in IMS
2. Mark it as shipped with tracking number
3. Check Shopify - order should show as fulfilled

---

## Troubleshooting

### OAuth Error: "Invalid redirect URI"
- Check that redirect URL in Shopify app matches exactly
- Include the full path: `/api/integrations/shopify/callback`

### Webhooks not received
- Check ngrok is running
- Check ngrok URL matches NEXT_PUBLIC_APP_URL
- Check Shopify webhook logs in Partner Dashboard

### "Integration not found" errors
- Check database has the integration record
- Check client_id matches logged-in client

### HMAC verification failed
- Check webhook_secret was saved correctly
- Check you're using the raw request body (not parsed JSON)

---

## Quick Reference

### Your Credentials (fill in)

```
Shopify Partner Email:    ___________________________
Development Store URL:    ___________________________.myshopify.com
App Client ID:            ___________________________
App Client Secret:        ___________________________
ngrok URL:                https://___________________.ngrok-free.app
```

### Important URLs

```
Partner Dashboard:        https://partners.shopify.com
Dev Store Admin:          https://YOUR-STORE.myshopify.com/admin
ngrok Inspector:          http://127.0.0.1:4040
Supabase Dashboard:       https://supabase.com/dashboard
```

### Terminal Commands

```bash
# Start Next.js
npm run dev

# Start ngrok
ngrok http 3000

# View ngrok requests
# Open: http://127.0.0.1:4040
```
