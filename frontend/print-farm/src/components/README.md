# Queue Management Template

This directory contains a template for managing print job queues in a 3D printing application, built using PatternFly components.

## Components

### QueueManagementTemplate.tsx

A comprehensive React component for managing print job queues. This template provides a complete UI for:

- Viewing and managing active print jobs
- Managing a pending queue of print jobs
- Viewing completed and failed jobs
- Filtering and sorting jobs
- Starting, pausing, resuming, and canceling jobs
- Assigning jobs to available printers

## Usage

### Installation

1. Install the required dependencies:

```bash
npm install @patternfly/react-core @patternfly/react-icons
```

2. Import the component:

```tsx
import QueueManagement from './components/QueueManagementTemplate';
```

### Basic Implementation

```tsx
import React, { useState } from 'react';
import QueueManagement from './components/QueueManagementTemplate';

const App = () => {
  // Your job and printer data
  const [jobs, setJobs] = useState([]);
  const [printers, setPrinters] = useState([]);

  // Handler functions
  const handleMoveJobUp = (id) => {
    // Implementation
  };

  const handleMoveJobDown = (id) => {
    // Implementation
  };

  const handleStartJob = (jobId, printerId) => {
    // Implementation
  };

  const handlePauseJob = (id) => {
    // Implementation
  };

  const handleResumeJob = (id) => {
    // Implementation
  };

  const handleCancelJob = (id) => {
    // Implementation
  };

  const handleSelectJob = (id) => {
    // Implementation
  };

  const handleRefresh = () => {
    // Implementation
  };

  return (
    <QueueManagement
      jobs={jobs}
      printers={printers}
      onMoveJobUp={handleMoveJobUp}
      onMoveJobDown={handleMoveJobDown}
      onStartJob={handleStartJob}
      onPauseJob={handlePauseJob}
      onResumeJob={handleResumeJob}
      onCancelJob={handleCancelJob}
      onSelectJob={handleSelectJob}
      onRefresh={handleRefresh}
    />
  );
};

export default App;
```

## Features

### Job Management

- **Active Jobs**: View and manage currently printing or paused jobs
- **Pending Queue**: Manage jobs waiting to be printed
- **Completed Jobs**: View history of completed and failed jobs

### Job Actions

- Start a job on a specific printer
- Pause/resume active jobs
- Cancel jobs
- Reorder pending jobs (move up/down)

### Filtering and Sorting

- Search jobs by name or filename
- Filter by job status
- Sort by creation date, name, or estimated time
- Toggle sort order (ascending/descending)

### Job Details

Each job displays:
- Thumbnail image (if available)
- Job name and filename
- Status with color-coded indicator
- Filament type and color
- Estimated print time
- Progress bar (for active jobs)
- Time remaining (for active jobs)

## Customization

The template uses PatternFly components and styling. You can customize the appearance by:

1. Using PatternFly's built-in props for component customization
2. Using PatternFly's utility classes
3. Creating a custom theme that overrides PatternFly's default styles

## Integration with Backend

To integrate with a backend API:

1. Replace the handler functions with API calls
2. Implement data fetching in a useEffect hook
3. Add loading states and error handling

## Example with API Integration

```tsx
import React, { useState, useEffect } from 'react';
import QueueManagement from './components/QueueManagementTemplate';
import { fetchJobs, fetchPrinters, updateJobStatus } from './api';
import { Spinner } from '@patternfly/react-core';

const App = () => {
  const [jobs, setJobs] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [jobsData, printersData] = await Promise.all([
          fetchJobs(),
          fetchPrinters()
        ]);
        setJobs(jobsData);
        setPrinters(printersData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Set up polling or WebSocket for real-time updates
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStartJob = async (jobId, printerId) => {
    try {
      await updateJobStatus(jobId, 'printing', printerId);
      // Refresh data
      const [jobsData, printersData] = await Promise.all([
        fetchJobs(),
        fetchPrinters()
      ]);
      setJobs(jobsData);
      setPrinters(printersData);
    } catch (err) {
      setError(err.message);
    }
  };

  // Other handler functions...

  if (loading) return <Spinner />;
  if (error) return <div>Error: {error}</div>;

  return (
    <QueueManagement
      jobs={jobs}
      printers={printers}
      onMoveJobUp={handleMoveJobUp}
      onMoveJobDown={handleMoveJobDown}
      onStartJob={handleStartJob}
      onPauseJob={handlePauseJob}
      onResumeJob={handleResumeJob}
      onCancelJob={handleCancelJob}
      onSelectJob={handleSelectJob}
      onRefresh={() => {
        // Refresh data
        fetchJobs().then(setJobs);
        fetchPrinters().then(setPrinters);
      }}
    />
  );
};

export default App;
``` 