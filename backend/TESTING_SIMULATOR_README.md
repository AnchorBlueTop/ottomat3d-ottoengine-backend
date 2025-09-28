# Slot Algorithm Testing Simulator

## Purpose
This interactive CLI tool allows you to test the OTTOMAT3D dynamic storing/grabbing algorithm without needing the full backend running. Perfect for validating the algorithm logic with different rack configurations and print job sequences.

## Usage

### Running the Simulator
```bash
# Make executable (first time only)
chmod +x test-slot-algorithm.js

# Run the simulator
./test-slot-algorithm.js

# Or run with Node
node test-slot-algorithm.js
```

### Simulator Steps

1. **Configure Rack**
   - Enter slot clearance (default: 80mm)
   - Enter number of slots (default: 6)

2. **Set Initial Rack State** (top-down, slot 6 to 1)
   - `o` = occupied (has stored print)
   - `e` = empty plate (fresh build plate)
   - `n` = nothing (completely empty)

3. **Input Print Jobs**
   - Enter number of jobs to simulate
   - Enter height (in mm) for each job

4. **Watch Simulation**
   - Algorithm finds optimal storage slot
   - Shows grab operations if plates needed
   - Updates rack state after each job
   - Displays clearance and scoring details

## Example Sessions

### Scenario 1: Small prints with limited space
```
Initial state (slots 6→1): n n e e o o
Print jobs: 30mm, 25mm, 40mm
Expected: Uses in-place storage on empty plates, then slot 6
```

### Scenario 2: Mixed height optimization
```
Initial state (slots 6→1): n n n e e n
Print jobs: 200mm, 50mm, 80mm, 30mm
Expected: 200mm goes to slot 1-3, small prints preserve high clearance
```

### Scenario 3: Forced high slot usage
```
Initial state (slots 6→1): e n o o o o
Print jobs: 30mm, 40mm
Expected: Small prints must use slots 5-6 despite waste
```

## Algorithm Features Tested

- **Height Categories**: TINY (≤30mm) through VERY_TALL (≤320mm)
- **Multi-Factor Scoring**: 
  - Height efficiency (40%)
  - Slot position preference (30%)
  - Clearance waste penalty (20%)
  - Future job flexibility (10%)
- **Dynamic Clearance**: Recalculates based on current state
- **Smart Grab Strategy**: Prefers higher slots to preserve storage

## Understanding the Output

### Rack Display
```
Slot 6: ⬜ NOTHING (480mm clearance)
Slot 5: 🟦 EMPTY PLATE (80mm clearance)
Slot 4: 📦 OCCUPIED (80mm clearance)
```

### Operation Log
```
Finding storage for 150mm print (needs 160mm clearance)
Selected slot 2 (score: 0.825)
1. Grab plate from slot 5
2. Store 150mm print in slot 2
   Strategy: place_and_store
   Clearance: 240mm
   Score: 0.825
```

## Testing Guidelines

1. **Test Edge Cases**:
   - All slots occupied except one
   - No plates available
   - Very tall prints (>240mm)
   - Many small prints when only high slots available

2. **Verify Bottom-Up Strategy**:
   - Small prints should prefer lower slots
   - Tall prints should get adequate clearance
   - Slot 6 preserved for tallest prints

3. **Check Plate Management**:
   - Grabbing from optimal slots
   - In-place storage when possible
   - Proper state transitions

## Interpreting Results

- **High Score (>0.8)**: Excellent slot choice
- **Medium Score (0.5-0.8)**: Acceptable placement
- **Low Score (<0.5)**: Forced placement due to constraints

The simulator helps validate that the algorithm:
- Makes logical decisions
- Handles constrained scenarios
- Optimizes for future flexibility
- Properly manages plate lifecycle
