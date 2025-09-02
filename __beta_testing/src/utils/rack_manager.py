"""
Rack Management System for OTTOMAT3D
Validates storage rack slot assignments to prevent conflicts
"""

class RackManager:
    def __init__(self, total_slots=6):
        """Initialize rack manager with specified number of slots"""
        self.total_slots = total_slots
        self.reset_rack()
    
    def reset_rack(self, slot_count=None):
        """Reset rack to initial state (all slots empty)"""
        effective_slot_count = slot_count if slot_count is not None else self.total_slots
        self.rack_state = {i: "empty" for i in range(1, effective_slot_count + 1)}
        self.simulation_log = []
    
    def validate_job_sequence(self, jobs, initial_rack_state=None, slot_count=None):
        """
        Validate a complete job sequence for rack conflicts
        
        Args:
            jobs: Dict of job configurations {job_num: {filename, store_slot, grab_slot}}
            initial_rack_state: Optional dict of initial rack state {slot: content}
            slot_count: Number of rack slots to use (overrides self.total_slots)
        
        Returns:
            Dict with 'valid' boolean and 'error' message if invalid
        """
        # Use provided slot count or default to instance value
        effective_slot_count = slot_count if slot_count is not None else self.total_slots
        
        # Set initial rack state (either provided or reset to empty)
        if initial_rack_state is not None:
            self.rack_state = initial_rack_state.copy()
            self.simulation_log = []
        else:
            self.reset_rack(effective_slot_count)
        
        for job_num in sorted(jobs.keys()):
            job = jobs[job_num]
            store_slot = job['store_slot']
            grab_slot = job.get('grab_slot')
            
            # Validate store slot
            if not self._is_valid_slot(store_slot, effective_slot_count):
                return {
                    'valid': False,
                    'error': f"Job {job_num}: Invalid store slot {store_slot} (must be 1-{effective_slot_count})"
                }
            
            if self.rack_state[store_slot] != "empty":
                return {
                    'valid': False,
                    'error': f"Job {job_num}: Cannot store to slot {store_slot} - already occupied by {self.rack_state[store_slot]}"
                }
            
            # Validate grab slot if specified
            if grab_slot is not None:
                if not self._is_valid_slot(grab_slot, effective_slot_count):
                    return {
                        'valid': False,
                        'error': f"Job {job_num}: Invalid grab slot {grab_slot} (must be 1-{effective_slot_count})"
                    }
                
                if self.rack_state[grab_slot] == "empty":
                    return {
                        'valid': False,
                        'error': f"Job {job_num}: Cannot grab from slot {grab_slot} - slot is empty"
                    }
            
            # Simulate the job execution
            self._simulate_job(job_num, job)
        
        return {'valid': True, 'error': None}
    
    def _simulate_job(self, job_num, job):
        """Simulate a single job execution on the rack"""
        store_slot = job['store_slot']
        grab_slot = job.get('grab_slot')
        filename = job['filename']
        
        # Record initial state
        initial_state = self.rack_state.copy()
        
        # Grab plate if needed (this empties the slot)
        if grab_slot is not None:
            self.rack_state[grab_slot] = "empty"
            self.simulation_log.append({
                'job': job_num,
                'action': 'grab',
                'slot': grab_slot,
                'description': f"Grabbed plate from slot {grab_slot}"
            })
        
        # Store completed print (this occupies the slot)
        self.rack_state[store_slot] = f"job_{job_num}_{filename}"
        self.simulation_log.append({
            'job': job_num,
            'action': 'store',
            'slot': store_slot,
            'description': f"Stored completed Job {job_num} ({filename}) to slot {store_slot}"
        })
        
        # Log the state change
        self.simulation_log.append({
            'job': job_num,
            'action': 'state',
            'before': initial_state,
            'after': self.rack_state.copy(),
            'description': f"Rack state after Job {job_num}"
        })
    
    def _is_valid_slot(self, slot, slot_count=None):
        """Check if slot number is valid"""
        effective_slot_count = slot_count if slot_count is not None else self.total_slots
        return isinstance(slot, int) and 1 <= slot <= effective_slot_count
    
    def get_simulation_summary(self):
        """Get a summary of the rack simulation"""
        if not self.simulation_log:
            return "No simulation data available"
        
        summary = []
        summary.append("RACK SIMULATION SUMMARY:")
        summary.append("=" * 50)
        summary.append("Initial State: All slots empty")
        summary.append("")
        
        for entry in self.simulation_log:
            if entry['action'] in ['grab', 'store']:
                summary.append(f"Job {entry['job']}: {entry['description']}")
            elif entry['action'] == 'state':
                summary.append(f"  Final rack state: {self._format_rack_state(entry['after'])}")
                summary.append("")
        
        return "\n".join(summary)
    
    def _format_rack_state(self, state):
        """Format rack state for display"""
        formatted = []
        for slot in range(1, self.total_slots + 1):
            content = state[slot]
            if content == "empty":
                formatted.append(f"Slot {slot}: Empty")
            else:
                formatted.append(f"Slot {slot}: {content}")
        return "; ".join(formatted)
    
    def check_final_rack_utilization(self):
        """Check how efficiently the rack is used"""
        occupied_slots = sum(1 for state in self.rack_state.values() if state != "empty")
        utilization = (occupied_slots / self.total_slots) * 100
        
        return {
            'occupied_slots': occupied_slots,
            'total_slots': self.total_slots,
            'utilization_percent': utilization,
            'available_slots': self.total_slots - occupied_slots
        }
    
    def suggest_optimization(self, jobs):
        """Suggest rack slot optimizations"""
        suggestions = []
        
        # Check for inefficient slot usage
        used_slots = set()
        for job in jobs.values():
            if job.get('grab_slot'):
                used_slots.add(job['grab_slot'])
            used_slots.add(job['store_slot'])
        
        # Suggest using consecutive slots for better organization
        if used_slots:
            min_slot = min(used_slots)
            max_slot = max(used_slots)
            if max_slot - min_slot + 1 > len(used_slots):
                suggestions.append(
                    f"Consider using consecutive slots ({min_slot}-{min_slot + len(used_slots) - 1}) "
                    "for better rack organization"
                )
        
        # Check for potential deadlocks
        store_slots = {job['store_slot'] for job in jobs.values()}
        grab_slots = {job.get('grab_slot') for job in jobs.values() if job.get('grab_slot')}
        
        if store_slots & grab_slots:
            overlapping = store_slots & grab_slots
            suggestions.append(
                f"Slots {overlapping} are used for both storing and grabbing. "
                "Ensure timing is correct to avoid conflicts."
            )
        
        return suggestions
    
    def display_rack_visualization(self):
        """Display a visual representation of the current rack state"""
        print("\nRACK VISUALIZATION:")
        print("=" * 50)
        
        for slot in range(1, self.total_slots + 1):
            content = self.rack_state[slot]
            if content == "empty":
                status = "[ EMPTY ]"
            else:
                status = f"[{content[:8]}...]" if len(content) > 10 else f"[{content}]"
            
            print(f"Slot {slot}: {status}")
        
        utilization = self.check_final_rack_utilization()
        print(f"\nUtilization: {utilization['occupied_slots']}/{utilization['total_slots']} slots "
              f"({utilization['utilization_percent']:.1f}%)")
