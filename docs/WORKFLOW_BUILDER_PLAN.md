# Workflow Builder - Implementation Plan

## Overview

Build a high-end, ultra-customizable workflow management system that allows administrators to create, configure, and manage operational workflows for different client types and industries without code changes.

---

## Phase 1: Foundation & Core UI

### 1.1 Database Schema Enhancements

```sql
-- Extend workflow_profiles table
ALTER TABLE workflow_profiles ADD COLUMN IF NOT EXISTS
  icon VARCHAR(50),                    -- Lucide icon name
  color VARCHAR(7),                    -- Hex color for UI
  sort_order INTEGER DEFAULT 0,

  -- Inbound settings
  inbound_requires_po BOOLEAN DEFAULT true,
  inbound_requires_appointment BOOLEAN DEFAULT false,
  inbound_auto_create_lots BOOLEAN DEFAULT true,
  inbound_lot_format VARCHAR(100) DEFAULT 'LOT-{YYYY}{MM}{DD}-{SEQ}',

  -- Outbound settings
  outbound_requires_approval BOOLEAN DEFAULT false,
  outbound_auto_allocate BOOLEAN DEFAULT true,
  outbound_pick_strategy VARCHAR(20) DEFAULT 'FEFO', -- FEFO, FIFO, LIFO
  outbound_packing_slip_template VARCHAR(50),

  -- Inventory settings
  inventory_allow_negative BOOLEAN DEFAULT false,
  inventory_track_serial_numbers BOOLEAN DEFAULT false,
  inventory_cycle_count_frequency INTEGER, -- days

  -- Quality settings
  quality_inspection_required BOOLEAN DEFAULT false,
  quality_quarantine_days INTEGER DEFAULT 0,

  -- Shipping settings
  shipping_carriers JSONB DEFAULT '[]',
  shipping_default_service VARCHAR(50),
  shipping_requires_signature BOOLEAN DEFAULT false,
  shipping_insurance_threshold DECIMAL(10,2),

  -- Returns settings
  returns_allowed BOOLEAN DEFAULT true,
  returns_window_days INTEGER DEFAULT 30,
  returns_requires_rma BOOLEAN DEFAULT true,

  -- Billing settings
  billing_model VARCHAR(20) DEFAULT 'per_order', -- per_order, per_unit, monthly
  billing_storage_rate DECIMAL(10,4),
  billing_pick_rate DECIMAL(10,4),
  billing_pack_rate DECIMAL(10,4);

-- Custom fields per workflow
CREATE TABLE IF NOT EXISTS workflow_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_profile_id UUID REFERENCES workflow_profiles(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(200) NOT NULL,
  field_type VARCHAR(20) NOT NULL, -- text, number, date, select, boolean, file
  field_options JSONB, -- for select type: [{value, label}]
  applies_to VARCHAR(20) NOT NULL, -- product, inbound, outbound, inventory, lot
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,
  validation_regex VARCHAR(500),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow automation rules
CREATE TABLE IF NOT EXISTS workflow_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_profile_id UUID REFERENCES workflow_profiles(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL, -- inbound_received, outbound_created, inventory_low, etc.
  trigger_conditions JSONB DEFAULT '{}',
  action_type VARCHAR(50) NOT NULL, -- send_email, create_task, update_status, webhook
  action_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow document templates
CREATE TABLE IF NOT EXISTS workflow_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_profile_id UUID REFERENCES workflow_profiles(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- packing_slip, shipping_label, invoice, pick_list
  template_name VARCHAR(200) NOT NULL,
  template_content TEXT, -- HTML template with variables
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow notification rules
CREATE TABLE IF NOT EXISTS workflow_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_profile_id UUID REFERENCES workflow_profiles(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  notify_client BOOLEAN DEFAULT false,
  notify_staff BOOLEAN DEFAULT false,
  email_template_id UUID,
  sms_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true
);
```

### 1.2 Settings Page Structure

```
/settings/workflows
├── WorkflowListPage
│   ├── Header with "Create Workflow" button
│   ├── Search/filter bar
│   ├── Workflow cards (grid view) or table
│   └── Each card shows: icon, name, industry, client count, status

/settings/workflows/new
/settings/workflows/[id]
├── WorkflowEditorPage (tabbed interface)
    ├── Tab: General
    │   ├── Basic info (name, code, description)
    │   ├── Icon picker
    │   ├── Color picker
    │   └── Industry selector
    │
    ├── Tab: Compliance & Requirements
    │   ├── Section: Tracking Requirements
    │   │   ├── Lot tracking toggle + format builder
    │   │   ├── Expiration dates toggle
    │   │   └── Serial number tracking toggle
    │   ├── Section: Regulatory
    │   │   ├── Age verification toggle
    │   │   ├── TTB compliance toggle
    │   │   └── State restrictions toggle + state selector
    │   └── Section: Quality Control
    │       ├── Inspection required toggle
    │       └── Quarantine period input
    │
    ├── Tab: Inbound Operations
    │   ├── PO required toggle
    │   ├── Appointment scheduling toggle
    │   ├── Auto-create lots toggle
    │   ├── Lot number format builder
    │   └── Receiving checklist builder
    │
    ├── Tab: Outbound Operations
    │   ├── Approval workflow toggle
    │   ├── Pick strategy selector (FEFO/FIFO/LIFO)
    │   ├── Auto-allocation toggle
    │   ├── Packing requirements
    │   └── Document templates selector
    │
    ├── Tab: Inventory Rules
    │   ├── Allow negative inventory toggle
    │   ├── Cycle count frequency
    │   ├── Reorder point alerts toggle
    │   └── Location restrictions
    │
    ├── Tab: Shipping
    │   ├── Allowed carriers multi-select
    │   ├── Default service selector
    │   ├── Signature required toggle
    │   ├── Insurance threshold input
    │   └── Hazmat settings
    │
    ├── Tab: Returns
    │   ├── Returns allowed toggle
    │   ├── Return window (days)
    │   ├── RMA required toggle
    │   └── Restocking rules
    │
    ├── Tab: Custom Fields
    │   ├── Field list with drag-to-reorder
    │   ├── Add field button
    │   └── Field editor modal
    │       ├── Field name/label
    │       ├── Type selector
    │       ├── Applies to (product/order/lot)
    │       ├── Required toggle
    │       ├── Default value
    │       └── Validation rules
    │
    ├── Tab: Automations
    │   ├── Automation rules list
    │   ├── Add automation button
    │   └── Automation builder modal
    │       ├── Trigger selector
    │       ├── Condition builder (AND/OR logic)
    │       └── Action configurator
    │
    ├── Tab: Notifications
    │   ├── Event-based notification matrix
    │   ├── Email templates
    │   └── Webhook configuration
    │
    ├── Tab: Billing
    │   ├── Billing model selector
    │   ├── Rate configuration
    │   └── Surcharge rules
    │
    └── Tab: Portal Settings
        ├── Features available to clients
        ├── Visible fields
        └── Self-service options
```

---

## Phase 2: Core Components

### 2.1 Workflow List Page

**File:** `src/app/(internal)/settings/workflows/page.tsx`

Features:
- Grid/List view toggle
- Search by name/code
- Filter by industry, status
- Workflow cards showing:
  - Icon + color badge
  - Name and description
  - Industry tag
  - Active clients count
  - Quick actions (edit, duplicate, deactivate)
- Bulk actions (activate/deactivate multiple)

### 2.2 Workflow Editor Page

**File:** `src/app/(internal)/settings/workflows/[id]/page.tsx`

Features:
- Tabbed interface with icons
- Auto-save with visual indicator
- Change history/audit log
- Preview mode (see how client portal looks)
- Duplicate workflow button
- Import/Export workflow as JSON

### 2.3 Reusable Components

```
src/components/workflow-builder/
├── WorkflowCard.tsx           -- Card display for list
├── WorkflowTabs.tsx           -- Tab navigation
├── GeneralSettingsForm.tsx    -- Basic info form
├── ComplianceSettings.tsx     -- Toggles for compliance
├── InboundSettings.tsx        -- Inbound configuration
├── OutboundSettings.tsx       -- Outbound configuration
├── InventorySettings.tsx      -- Inventory rules
├── ShippingSettings.tsx       -- Carrier/shipping config
├── ReturnsSettings.tsx        -- Return policies
├── CustomFieldBuilder.tsx     -- Custom field CRUD
├── AutomationBuilder.tsx      -- Rule builder
├── NotificationMatrix.tsx     -- Event notification grid
├── BillingSettings.tsx        -- Pricing configuration
├── PortalSettings.tsx         -- Client portal options
├── LotFormatBuilder.tsx       -- Lot number format designer
├── ConditionBuilder.tsx       -- AND/OR condition UI
├── IconPicker.tsx             -- Icon selection modal
└── ColorPicker.tsx            -- Color selection
```

---

## Phase 3: Advanced Features

### 3.1 Lot Number Format Builder

Visual builder for lot number formats:

```
Format: LOT-{YYYY}{MM}{DD}-{SEQ}
Preview: LOT-20260203-001

Available Variables:
├── {YYYY} - 4-digit year
├── {YY} - 2-digit year
├── {MM} - Month (01-12)
├── {DD} - Day (01-31)
├── {SEQ} - Sequential number
├── {SEQ:4} - Sequential with padding
├── {CLIENT} - Client code
├── {PRODUCT} - Product SKU prefix
├── {PO} - PO number
└── {RANDOM:6} - Random alphanumeric
```

### 3.2 Automation Rule Builder

Visual condition/action builder:

```
WHEN [Trigger]
├── Inbound Received
├── Outbound Created
├── Inventory Below Reorder Point
├── Order Shipped
├── Return Requested
└── Custom webhook

IF [Conditions] (optional)
├── Product category = X
├── Order value > $Y
├── Client = Z
└── Custom field = value

THEN [Actions]
├── Send email to [recipient]
├── Send SMS to [phone]
├── Create task for [team]
├── Update status to [status]
├── Call webhook [url]
├── Generate document [template]
└── Add tag [tag]
```

### 3.3 Custom Field Types

| Type | UI Component | Validation |
|------|--------------|------------|
| text | Input | Regex pattern |
| textarea | Textarea | Max length |
| number | Number input | Min/max |
| decimal | Decimal input | Precision |
| date | Date picker | Min/max date |
| datetime | DateTime picker | Range |
| select | Dropdown | Options list |
| multiselect | Multi-select | Options list |
| boolean | Toggle | - |
| file | File upload | File types, max size |
| image | Image upload | Dimensions, size |
| url | URL input | URL validation |
| email | Email input | Email validation |
| phone | Phone input | Phone format |
| barcode | Barcode scanner | Format validation |

### 3.4 Notification Matrix

| Event | Client Email | Client SMS | Staff Email | Webhook |
|-------|--------------|------------|-------------|---------|
| Inbound received | ☑ | ☐ | ☑ | ☐ |
| Order confirmed | ☑ | ☐ | ☐ | ☑ |
| Order shipped | ☑ | ☑ | ☐ | ☑ |
| Low inventory | ☑ | ☐ | ☑ | ☐ |
| Return approved | ☑ | ☐ | ☑ | ☐ |

---

## Phase 4: Integration Points

### 4.1 How Workflows Affect Operations

**Product Creation:**
- Show custom fields based on workflow
- Validate required workflow fields
- Set default values from workflow

**Inbound Orders:**
- Enforce PO requirement
- Show appointment scheduling
- Auto-generate lot numbers
- Show workflow-specific checklists

**Outbound Orders:**
- Apply pick strategy (FEFO/FIFO/LIFO)
- Enforce approval workflow
- Select document templates
- Apply shipping rules

**Inventory:**
- Enforce lot tracking
- Validate expiration dates
- Apply cycle count rules

**Client Portal:**
- Show/hide features based on workflow
- Display custom fields
- Apply self-service restrictions

### 4.2 API Endpoints

```
GET    /api/workflows              -- List all workflows
GET    /api/workflows/:id          -- Get workflow details
POST   /api/workflows              -- Create workflow
PUT    /api/workflows/:id          -- Update workflow
DELETE /api/workflows/:id          -- Delete workflow
POST   /api/workflows/:id/duplicate -- Duplicate workflow

GET    /api/workflows/:id/custom-fields
POST   /api/workflows/:id/custom-fields
PUT    /api/workflows/:id/custom-fields/:fieldId
DELETE /api/workflows/:id/custom-fields/:fieldId

GET    /api/workflows/:id/automations
POST   /api/workflows/:id/automations
PUT    /api/workflows/:id/automations/:autoId
DELETE /api/workflows/:id/automations/:autoId

GET    /api/workflows/:id/notifications
PUT    /api/workflows/:id/notifications
```

---

## Phase 5: UI Polish

### 5.1 Visual Design

- **Cards**: Rounded corners, subtle shadows, icon + color accent
- **Tabs**: Icon + label, active indicator, smooth transitions
- **Toggles**: Animated switches with color states
- **Forms**: Section headers, help text, inline validation
- **Modals**: Slide-in panels for complex editors
- **Drag & Drop**: Reorder custom fields, automation rules

### 5.2 UX Features

- Auto-save with debounce (show "Saving..." / "Saved")
- Undo/redo support for form changes
- Keyboard shortcuts (Ctrl+S to save)
- Inline help tooltips
- Contextual examples
- Validation with friendly error messages
- Progress indicator for long saves
- Confirmation dialogs for destructive actions

---

## Implementation Order

### Sprint 1: Foundation (Week 1)
- [ ] Database migrations for new columns/tables
- [ ] API functions for CRUD operations
- [ ] Workflow list page with cards
- [ ] Basic create/edit form (General tab only)

### Sprint 2: Core Settings (Week 2)
- [ ] Compliance & Requirements tab
- [ ] Inbound Operations tab
- [ ] Outbound Operations tab
- [ ] Inventory Rules tab

### Sprint 3: Shipping & Returns (Week 3)
- [ ] Shipping settings tab
- [ ] Returns settings tab
- [ ] Carrier integration
- [ ] Document template selector

### Sprint 4: Custom Fields (Week 4)
- [ ] Custom field builder UI
- [ ] Field type components
- [ ] Validation rules
- [ ] Integration with product/order forms

### Sprint 5: Automations (Week 5)
- [ ] Automation rule builder
- [ ] Condition builder component
- [ ] Action configurator
- [ ] Automation execution engine

### Sprint 6: Notifications & Billing (Week 6)
- [ ] Notification matrix
- [ ] Email template integration
- [ ] Billing settings
- [ ] Rate configuration

### Sprint 7: Portal & Polish (Week 7)
- [ ] Portal settings tab
- [ ] Workflow preview mode
- [ ] Import/export JSON
- [ ] UI polish and animations

### Sprint 8: Testing & Refinement (Week 8)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] User feedback implementation

---

## Success Metrics

- Admin can create a new workflow in < 5 minutes
- All workflow settings configurable without code changes
- Custom fields appear automatically in relevant forms
- Automation rules execute reliably
- Zero workflow-related support tickets after training

---

---

## Product-Level Workflow Override

### Overview

Allows specific products to have their own workflow profile instead of using the client's default workflow. This is useful when a client has products with different handling requirements (e.g., hazmat vs regular items, or different compliance needs).

### Database Changes

```sql
-- Add toggle to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS allow_product_workflow_override BOOLEAN DEFAULT false;

-- Add workflow override to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS workflow_profile_id UUID REFERENCES workflow_profiles(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_workflow_profile
ON products(workflow_profile_id) WHERE workflow_profile_id IS NOT NULL;
```

### How It Works

1. **Admin enables feature**: On the client detail page (`/clients/[id]`), toggle "Allow Product-Level Workflow Override" in the Workflow Profile section

2. **Assign workflow to product**: When editing a product (`/products/[id]`), if the client allows overrides, a workflow selector appears under the Client field

3. **Enforcement priority**: When processing orders, the system checks:
   - First: Does the product have its own `workflow_profile_id`?
   - If yes AND client has `allow_product_workflow_override = true`: Use product's workflow
   - Otherwise: Use client's default workflow

### Key Files

- `src/lib/api/clients.ts` - Client interface with `allow_product_workflow_override`
- `src/lib/api/products.ts` - Product interface with `workflow_profile_id`
- `src/lib/api/workflow-profiles.ts` - Enforcement functions:
  - `getProductWorkflowProfile(productId)` - Get product's specific workflow
  - `getEffectiveWorkflowProfile(clientId, productId?)` - Get effective workflow with fallback
  - All `getClient*Rules()` functions now accept optional `productId` parameter

### UI Components

**Client Detail Page** (`/clients/[id]`):
- Toggle switch in Workflow Profile section
- Info box explaining the feature when enabled

**Product Form** (`ProductForm.tsx`):
- Workflow profile selector appears when:
  - Client is selected
  - Client has `allow_product_workflow_override = true`
- Hint text explains the override behavior

### Example Use Cases

1. **Wine + Beer Distribution**: Client sells both wine (requires TTB compliance) and beer (different regulations) - each product type can have its own workflow

2. **Hazmat vs Regular**: Some products require special handling, shipping restrictions, and documentation

3. **Temperature-Sensitive Products**: Certain SKUs need cold chain workflow while others are ambient

---

## Future Enhancements

- **Workflow Templates**: Pre-built workflows for common industries
- **A/B Testing**: Test different workflow settings
- **Analytics**: Workflow performance metrics
- **AI Suggestions**: Recommend settings based on industry
- **Multi-language**: Localized field labels
- **API-first**: Full workflow config via API
- **Version Control**: Track workflow changes over time
- **Approval Workflow**: Require approval for workflow changes
- **Bulk Product Workflow Assignment**: Assign workflows to multiple products at once
