# Slot Algorithm Testing Script - Updated November 2025

## Overview
The `test-slot-algorithm.js` script has been updated to match the current production orchestration system behavior. Use this script to test different print heights and see how the algorithm assigns storage slots.

## What's New (November 2025)

### 1. **Empty Plate Slots Are Reserved**
- ✅ **empty_plate** slots are NEVER used for storage
- They are reserved exclusively for grabbing to load onto printers
- Only **nothing** (no_plate) slots can store completed prints

### 2. **Updated Scoring Weights**
```javascript
AVAILABILITY:        0.3  (NEW - prioritizes immediate slots)
HEIGHT_EFFICIENCY:   0.3  (was 0.4)
SLOT_POSITION:       0.2  (was 0.3)
CLEARANCE_WASTE:    0.15  (was 0.2)
FUTURE_FLEXIBILITY: 0.05  (was 0.1)
```

### 3. **New Strategy Names**
- `store_immediate` - Store in available no_plate slot (was: in_place/place_and_store)
- Printer is assumed to already have a plate from previous job

### 4. **Enhanced Output**
- Shows detailed score breakdown for each decision
- Displays contribution of each factor (availability, height efficiency, position, waste, future)

## How to Use

### 1. Run the Script
```bash
cd backend
node test-slot-algorithm.js
```

### 2. Configure Rack
```
Enter slot clearance in mm (default 80): 80
Enter number of slots (default 6): 6
```

### 3. Set Initial Rack State
For each slot (from top to bottom), enter:
- `o` = occupied (has a completed print)
- `e` = empty plate (clean plate, reserved for grabbing)
- `n` = nothing (empty slot, can be used for storage)

**Example:**
```
Slot 6: n
Slot 5: n
Slot 4: n
Slot 3: e  ← Reserved for grabbing
Slot 2: e  ← Reserved for grabbing
Slot 1: e  ← Reserved for grabbing
```

### 4. Input Print Jobs
```
How many print jobs to simulate? 3
Height of print job 1 (mm): 25
Height of print job 2 (mm): 150
Height of print job 3 (mm): 60
```

### 5. Review Results
The script will show:
- Which slot was selected for each print
- Score breakdown showing why that slot was chosen
- Rack state evolution after each job
- Final statistics (utilization, fragmentation)

## Example Test Scenarios

### Scenario 1: Mixed Heights with Empty Plates
**Initial State:**
```
Slot 6: nothing
Slot 5: nothing
Slot 4: nothing
Slot 3: empty_plate
Slot 2: empty_plate
Slot 1: empty_plate
```

**Print Jobs:** 20mm, 100mm, 50mm, 180mm

**Expected Behavior:**
- 20mm → Slot 4 (good fit for tiny print)
- 100mm → Slot 5 (medium print needs more clearance)
- 50mm → Slot 6 (small print)
- 180mm → Cannot fit (needs tall slot)

### Scenario 2: Testing Clearance Blocking
**Initial State:**
```
Slot 6: nothing
Slot 5: nothing
Slot 4: nothing
Slot 3: nothing
Slot 2: nothing
Slot 1: nothing
```

**Print Jobs:** 200mm, 50mm

**Expected Behavior:**
- 200mm → Slot 4 or 5 (tall print needs lower slots with clearance)
- 50mm → Might select slot above the 200mm print if enough clearance

### Scenario 3: Full Rack Utilization
**Initial State:** All slots = nothing

**Print Jobs:** 30mm, 40mm, 60mm, 80mm, 120mm, 150mm

**Expected Behavior:**
- Algorithm should pack efficiently
- Show utilization % at the end
- Display fragmentation metrics

## Understanding the Score Breakdown

When a job is assigned, you'll see:
```
Score: 0.620

Score breakdown:
  Availability: 0.300 (1.00 × 0.3)    ← Immediate slot
  Height Eff:   0.180 (0.60 × 0.3)    ← 60% clearance utilization
  Position:     0.160 (0.80 × 0.2)    ← Good position for height category
  Waste:        0.105 (0.70 × 0.15)   ← Acceptable waste
  Future:       0.040 (0.80 × 0.05)   ← Future jobs can still fit
```

### Interpreting Scores:
- **Higher score = Better choice**
- **Availability** dominates (0.3 weight) - immediate slots strongly preferred
- **Height Efficiency** ensures good fit (avoid wasting tall slots on short prints)
- **Position** matches print category to appropriate slot
- **Waste** penalizes excessive clearance waste
- **Future** considers if future jobs can still fit

## Key Differences from Old System

| Aspect | Old Behavior | New Behavior (Nov 2025) |
|--------|--------------|-------------------------|
| Empty Plates | Used for "in-place" storage | Reserved for grabbing only |
| Storage Slots | Both empty_plate and nothing | Only nothing slots |
| Availability Weight | Not considered | 0.3 (highest weight) |
| Strategy Names | in_place, place_and_store | store_immediate |
| Plate Grabbing | Simulated in test | Not shown (assumed handled) |

## Troubleshooting

### "No slots available" Error
- **Cause**: All no_plate slots are occupied or blocked
- **Fix**: Add more "nothing" slots in initial state
- **Remember**: empty_plate slots don't count as available storage

### Jobs Selecting Unexpected Slots
- Check the score breakdown to understand the decision
- Higher availability weight (0.3) means immediate slots are strongly preferred
- Position score prefers lower slots for small prints, higher for tall prints

## Files Modified
- `test-slot-algorithm.js` - Main test script
- Matches logic in `src/utils/AdvancedSlotManager.js`

## Next Steps
After testing with this script, you can:
1. Verify algorithm behavior matches expectations
2. Test edge cases (very tall prints, full racks, etc.)
3. Compare results with actual orchestration runs
4. Adjust weights if needed (contact dev team)

---

**Last Updated:** November 30, 2025
**Compatible with:** OTTOengine v0.3 (Production Ready - Phase 3)
