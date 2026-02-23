# Warehouse Task Queue System

## Overview

The warehouse task queue automates the handoffs between receiving, inspection, putaway, and picking stages. Instead of staff manually discovering what work needs doing, the system generates directed tasks with priority ordering, location suggestions, and barcode-verified scanning.

## Architecture

### Central Table: `warehouse_tasks`

All three task types (inspection, putaway, pick) share a single `warehouse_tasks` table with polymorphic references to inbound/outbound orders. This enables a unified dashboard, shared lifecycle management, and cross-type reporting.

```
warehouse_tasks
├── task_number (INS-YYYYMMDD-0001, PUT-..., PCK-...)
├── task_type (inspection | putaway | pick)
├── status (pending → assigned → in_progress → completed/failed/cancelled)
├── priority (1-10, higher = more urgent)
├── order_id + order_type (polymorphic ref to inbound/outbound)
├── product_id, client_id, lpn_id, lot_id (FKs)
├── source_location_id, source_sublocation_id
├── destination_location_id, destination_sublocation_id
├── qty_requested, qty_completed
├── assigned_to, assigned_at, started_at, completed_at
└── metadata (JSONB for task-type-specific data)
```

### Supporting Tables

- **`inspection_results`** - Stores per-criterion pass/fail results and overall outcome
- **`pick_list_items`** - Individual pick lines with FEFO-allocated locations, quantities, and pick status

### API Layer: `src/lib/api/warehouse-tasks.ts`

Single API file following the `cycle-counts.ts` pattern:

| Section | Functions |
|---------|-----------|
| **CRUD** | `getWarehouseTasks(filters?)`, `getWarehouseTask(id)`, `createWarehouseTask(params)`, `updateWarehouseTask(id, updates)` |
| **Lifecycle** | `assignTask(id, userId)`, `startTask(id)`, `completeTask(id, opts?)`, `failTask(id, reason)`, `cancelTask(id)` |
| **Queue** | `getMyTasks(userId)`, `getTaskCountsByType()`, `getPendingTaskCount()` |
| **Inspection** | `getInspectionCriteria(clientId)`, `submitInspectionResult(taskId, params)` |
| **Putaway** | `createPutawayTask(params)`, `completePutawayTask(taskId, sublocationId)` |
| **Pick** | `generatePickList(orderId, locationId)`, `getPickListItems(taskId)`, `recordPickItem(id, qty)`, `recordShortPick(id, qty, reason?)` |

## Task Flows

### Inspection Flow

**Trigger:** `receiveInboundItem()`, `receiveWithLot()`, or `receiveInboundItemToPallet()` when client's workflow profile has `requiresInspection: true`.

```
1. Item received → check getClientInboundRules()
2. If requiresInspection:
   a. Create inspection task (priority 7)
   b. Set inventory status to 'quarantine'
3. Staff claims task from /tasks/inspection queue
4. InspectionScanner:
   a. Scan product barcode to verify identity
   b. Complete per-criterion pass/fail checklist
   c. Submit results
5. On pass: release quarantine → auto-create putaway task
6. On fail: create damage report via reportReceivingDamage()
```

**Inspection criteria** are stored in `workflow_profiles.inspection_criteria` (JSONB array). Default criteria if none configured:
- Visual inspection - no damage (required)
- Quantity matches PO (required)
- Labels intact and legible (optional)

### Putaway Flow

**Trigger 1:** After receiving, when inspection is NOT required.
**Trigger 2:** After inspection passes (automatic).

```
1. Putaway task created with:
   - Suggested destination from getSuggestedPutAway()
   - Priority 8 for perishable products (food/pharma), 5 for standard
2. Staff claims task from /tasks/putaway queue
3. PutawayScanner (task-driven mode):
   a. Product/LPN info auto-loaded from task
   b. Suggested destination pre-displayed
   c. Scan destination sublocation barcode
   d. Confirm putaway
4. completePutawayTask() handles:
   - moveLPN() if task has LPN
   - confirmPutAway() for inventory
   - Logs inventory_transaction type='putaway'
5. "Next Task" button loads next pending putaway task
```

### Pick List Flow

**Trigger:** `updateOutboundOrderStatus()` when status changes to `confirmed` (after reservation succeeds).

```
1. generatePickList() called:
   a. Fetch outbound_items with products
   b. For each item, allocate inventory using FEFO:
      - Lot inventory ordered by expiration_date ASC
      - Non-lot inventory ordered by created_at ASC
      - Split across multiple locations if needed
   c. Create pick_list_items with sequence_number (pick path order)
   d. Create warehouse_task type='pick'
2. Staff claims task from /tasks/pick queue
3. PickScanner (task-driven mode):
   a. Items loaded from pick_list_items (pre-ordered by sequence)
   b. Each item shows exact location + sublocation + lot number
   c. Scan product barcode to verify
   d. Confirm quantity or report short pick
4. recordPickItem() handles:
   - Update pick_list_items.qty_picked
   - Update outbound_items.qty_shipped
   - Deduct inventory via updateInventoryWithTransaction()
   - Auto-complete task when all items accounted for
5. recordShortPick() handles:
   - Mark item as 'short' without deducting inventory
   - Log activity for tracking
```

## UI Pages

| Route | Description |
|-------|-------------|
| `/tasks` | Unified dashboard with tab filters (All/Inspection/Putaway/Pick), status filters, "My Tasks" toggle, stat cards |
| `/tasks/[id]` | Task detail - renders differently per type, launches appropriate scanner in modal |
| `/tasks/inspection` | Inspection queue - sorted by priority/age, "Claim & Start" opens InspectionScanner |
| `/tasks/putaway` | Putaway queue - "Claim Next 5" for batch putaway, perishables highlighted |
| `/tasks/pick` | Pick list queue - progress bars per order, rush orders highlighted |

### Sidebar Integration

Tasks appear in the Operations nav group with sub-navigation:
- All Tasks (ClipboardCheck icon)
- Inspection (ShieldCheck icon)
- Putaway (ArrowDownToLine icon)
- Pick Lists (ListChecks icon)

Badge count shows total pending tasks, polled every 60 seconds.

### Order Detail Integration

- **Inbound detail:** Task status badges (amber for inspection, blue for putaway) on received items, linked to `/tasks/[id]`
- **Outbound detail:** Pick list section showing progress, short picks, and "Open Pick Scanner" button

## Scanner Components

### InspectionScanner (`src/components/internal/InspectionScanner.tsx`)

Props: `{ taskId: string; onComplete?: () => void }`

- Loads task + product + inspection criteria from client's workflow profile
- Optional barcode scan to verify product identity
- Dynamic checklist with pass/fail toggles per criterion
- Per-criterion and overall notes
- Submits via `submitInspectionResult()`
- Audio feedback via `playBeep()`

### PutawayScanner Enhancement

Added optional `taskId` prop. When provided:
- Auto-loads product/LPN info from task (skips scan step 1)
- Pre-displays suggested destination from task's destination sublocation
- Calls `completePutawayTask()` instead of standalone update
- "Next Task" button loads next pending putaway task
- Existing standalone mode preserved when no taskId

### PickScanner Enhancement

Added optional `taskId` prop. When provided:
- Loads `pick_list_items` instead of raw `outbound_items`
- Items pre-ordered by `sequence_number` (optimized pick path)
- Shows exact allocated location + sublocation + lot number
- "Short" button for short-pick reporting via `recordShortPick()`
- Calls `recordPickItem()` which updates both pick_list_items and outbound_items
- Auto-completes task when all items picked or accounted for
- Existing standalone mode preserved when no taskId

## Database Migration

The migration file is at `supabase/migrations/20260223_create_warehouse_tasks.sql` and must be applied manually (Supabase MCP was not authenticated during creation).

### Tables
- `warehouse_tasks` with indexes and RLS
- `inspection_results` with FK to warehouse_tasks
- `pick_list_items` with FKs to warehouse_tasks, outbound_items, products, lots, locations, sublocations

### RPC
- `generate_task_number(p_prefix TEXT)` returns sequential task numbers per day

### Column Addition
- `workflow_profiles.inspection_criteria` JSONB default `'[]'`

## FEFO Allocation Algorithm

The pick list generator uses First Expired, First Out ordering:

1. For each outbound item needing picking:
   a. Query `lot_inventory` WHERE `product_id` matches AND `qty_on_hand - qty_reserved > 0`, ORDER BY `lots.expiration_date ASC NULLS LAST`
   b. Allocate from earliest-expiring lots first
   c. If still need more, query non-lot `inventory` ORDER BY `created_at ASC`
   d. Split across multiple sublocations if single location insufficient
2. Assign `sequence_number` to each pick line for optimized pick path
3. Create `pick_list_items` rows with allocated quantities

## Priority System

| Priority | Label | Color | Auto-assigned When |
|----------|-------|-------|-------------------|
| 8-10 | Urgent | Red | Perishable products (food/pharma), rush orders |
| 6-7 | High | Amber | Inspection tasks (default 7), pick tasks (default 6) |
| 1-5 | Normal | Slate | Standard putaway (default 5) |
