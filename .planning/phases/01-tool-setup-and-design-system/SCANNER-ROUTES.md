# Scanner-Facing Routes

**Document type:** Pre-audit constraint reference
**Created:** 2026-03-18
**Phase:** 01-tool-setup-and-design-system

---

## Warehouse Floor Rubric

All scanner-facing routes must satisfy the following minimum requirements before any design recommendation is accepted:

| Criterion | Minimum | Preferred |
|-----------|---------|-----------|
| Tap target size | 44px | 56px |
| Body text size | 16px | 18px+ |
| Primary actions per screen | — | Max 3 |
| Contrast ratio | WCAG AA (4.5:1) | WCAG AAA (7:1) |
| Interaction style | No precision gestures | Glove-friendly (large targets, no swipe-to-reveal) |
| Lighting adaptability | Readable in variable warehouse lighting | High contrast mode support |

**Rejection rule:** Any audit finding or recommendation that would cause a scanner-facing route to fail the above criteria must be flagged as a blocker before it can be accepted.

---

## Target Devices

Scanner-facing routes must pass on both form factors:

- **Tablets:** 10-12" displays (primary floor device)
- **Phones:** 5-6" displays (secondary floor device, common during receiving/shipping)

Both form factors must pass all rubric criteria. Tablet-only or phone-only passes are not acceptable.

---

## Route Inventory

All 12 scanner-facing routes in the IMS 7D platform:

| Route Pattern | Description | Scanner Component(s) |
|--------------|-------------|----------------------|
| `/tasks/pick` | Picking workflow — operator picks items to fulfill outbound orders | `PickingScanner.tsx`, `PickScanner.tsx` |
| `/tasks/putaway` | Putaway workflow — operator places received goods into storage locations | `PutawayScanner.tsx` |
| `/tasks/inspection` | Inspection workflow — quality inspection of inbound/returned goods | `InspectionScanner.tsx` |
| `/tasks/[id]` | Task detail and execution — generic task completion screen | (task page) |
| `/cycle-counts/[id]` | Active cycle count — operator scans and counts inventory at location | (cycle count page) |
| `/inventory/pallet-breakdown` | Pallet breakdown scanning — disassemble pallets, re-slot contents | `PalletBreakdownScanner.tsx` |
| `/inbound/[id]` | Receiving workflow — scan and receive inbound shipments | `ReceivingScanner.tsx` |
| `/outbound/[id]` | Packing and shipping workflow — pack orders, generate labels | `PackScanner.tsx`, `ShipScanner.tsx` |
| `/returns/[id]` | Returns processing — inspect and restock or quarantine returned items | (returns page) |
| `/damage-reports/[id]` | Damage documentation — photograph and record damaged goods | (damage page) |
| `/locations/[id]/sublocations` | Sublocation navigation — browse and select warehouse sub-locations | (locations page) |
| `/inventory/transfers` | Stock transfers — move inventory between warehouse locations | (transfers page) |

**Total scanner-facing routes:** 12

---

## Shared Scanner Infrastructure

These components are used across multiple scanner-facing routes and must be audited as a unit:

| Component | Path | Used By |
|-----------|------|---------|
| `BarcodeScanner` | `src/components/ui/BarcodeScanner.tsx` | All scanner routes |
| `ScannerModal` | `src/components/internal/ScannerModal.tsx` | Modal-wrapped scanning flows |

**Audit note:** Changes to `BarcodeScanner.tsx` or `ScannerModal.tsx` have cross-cutting impact. Any recommendations targeting these components must be evaluated against all 12 routes, not just the one under review.

---

## Audit Usage

When auditing scanner-facing routes:

1. Apply the warehouse floor rubric above to every finding
2. Verify recommendations against both tablet and phone form factors
3. Flag any recommendation that reduces tap target size, increases interaction precision, or decreases contrast
4. Note shared component impact when a recommendation touches `BarcodeScanner.tsx` or `ScannerModal.tsx`
