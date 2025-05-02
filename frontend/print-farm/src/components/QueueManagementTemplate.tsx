import React, { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Flex,
  FlexItem,
  Label,
  Progress,
  SearchInput,
  Select,
  SelectOption,
  Stack,
  StackItem,
  Title,
  TitleSizes,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarFilter,
  ToolbarGroup,
  DropdownToggle,
  ToggleEvent
} from '@patternfly/react-core';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  PlayIcon,
  PauseIcon,
  TimesCircleIcon,
  ClockIcon,
  BarsIcon,
  PrintIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SyncIcon
} from '@patternfly/react-icons';

// Types
export type JobStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'paused';

export interface PrintJob {
  id: string;
  name: string;
  fileName: string;
  filamentType: string;
  filamentColor: string;
  estimatedTime: number; // in minutes
  progress: number; // 0-100
  status: JobStatus;
  printer: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  thumbnailUrl?: string;
  settings: {
    layerHeight: number;
    infill: number;
    supportEnabled: boolean;
    temperature: number;
    bedTemperature: number;
  };
}

export interface Printer {
  id: string;
  name: string;
  status: 'idle' | 'printing' | 'offline' | 'error';
  currentJob?: string;
  temperature: {
    nozzle: number;
    bed: number;
  };
  model: string;
}

// Job Component
interface JobProps {
  job: PrintJob;
  onClick?: () => void;
  actions?: React.ReactNode;
}

const Job: React.FC<JobProps> = ({ job, onClick, actions }) => {
  const getStatusColor = (status: string): "blue" | "green" | "grey" | "red" | "orange" => {
    switch (status) {
      case 'printing':
        return 'green';
      case 'pending':
        return 'blue';
      case 'completed':
        return 'grey';
      case 'failed':
        return 'red';
      case 'paused':
        return 'orange';
      default:
        return 'grey';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'printing':
        return <PrintIcon />;
      case 'pending':
        return <ClockIcon />;
      case 'completed':
        return <CheckCircleIcon />;
      case 'failed':
        return <ExclamationCircleIcon />;
      case 'paused':
        return <PauseIcon />;
      default:
        return <ClockIcon />;
    }
  };

  return (
    <Card isSelectable onClick={onClick}>
      <CardBody>
        <Flex>
          {job.thumbnailUrl && (
            <FlexItem>
              <img 
                src={job.thumbnailUrl} 
                alt={job.name} 
                style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px' }}
              />
            </FlexItem>
          )}
          <FlexItem flex={{ default: 'flex_1' }}>
            <Stack hasGutter>
              <StackItem>
                <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
                  <FlexItem>
                    <Title headingLevel="h3" size={TitleSizes.md}>{job.name}</Title>
                    <Title headingLevel="h4" size={TitleSizes.md}>{job.fileName}</Title>
                  </FlexItem>
                  <FlexItem>
                    <Label color={getStatusColor(job.status)} icon={getStatusIcon(job.status)}>
                      {job.status}
                    </Label>
                  </FlexItem>
                </Flex>
              </StackItem>
              <StackItem>
                <Flex>
                  <FlexItem>
                    <BarsIcon /> {job.filamentType} {job.filamentColor}
                  </FlexItem>
                  <FlexItem>
                    <ClockIcon /> {Math.floor(job.estimatedTime / 60)}h {job.estimatedTime % 60}m
                  </FlexItem>
                </Flex>
              </StackItem>
              {job.status === 'printing' && (
                <StackItem>
                  <Progress
                    value={job.progress}
                    title="Print Progress"
                    label={`${job.progress}% complete`}
                    measureLocation="outside"
                  />
                  <div className="pf-u-font-size-sm pf-u-color-200">
                    {Math.floor(job.estimatedTime * (100 - job.progress) / 100 / 60)}h{' '}
                    {Math.round(job.estimatedTime * (100 - job.progress) / 100 % 60)}m remaining
                  </div>
                </StackItem>
              )}
            </Stack>
          </FlexItem>
          {actions && <FlexItem>{actions}</FlexItem>}
        </Flex>
      </CardBody>
    </Card>
  );
};

// Queue Management Component
interface QueueManagementProps {
  jobs: PrintJob[];
  printers: Printer[];
  onMoveJobUp: (id: string) => void;
  onMoveJobDown: (id: string) => void;
  onStartJob: (id: string, printerId: string) => void;
  onPauseJob: (id: string) => void;
  onResumeJob: (id: string) => void;
  onCancelJob: (id: string) => void;
  onSelectJob?: (id: string) => void;
  onRefresh?: () => void;
}

const QueueManagement: React.FC<QueueManagementProps> = ({
  jobs,
  printers,
  onMoveJobUp,
  onMoveJobDown,
  onStartJob,
  onPauseJob,
  onResumeJob,
  onCancelJob,
  onSelectJob,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'estimatedTime'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [isSortByOpen, setIsSortByOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [isPrinterDropdownOpen, setIsPrinterDropdownOpen] = useState(false);

  // Filter and sort jobs
  const filteredJobs = jobs
    .filter(job => {
      const matchesSearch = job.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           job.fileName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'createdAt') {
        return sortOrder === 'asc' 
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime();
      } else if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        return sortOrder === 'asc'
          ? a.estimatedTime - b.estimatedTime
          : b.estimatedTime - a.estimatedTime;
      }
    });

  const pendingJobs = filteredJobs.filter(job => job.status === 'pending');
  const activeJobs = filteredJobs.filter(job => ['printing', 'paused'].includes(job.status));
  const completedJobs = filteredJobs.filter(job => ['completed', 'failed'].includes(job.status));
  const availablePrinters = printers.filter(printer => printer.status === 'idle');

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const renderEmptyState = (message: string) => (
    <EmptyState variant={EmptyStateVariant.sm}>
      <EmptyStateBody>{message}</EmptyStateBody>
    </EmptyState>
  );

  return (
    <Stack hasGutter>
      {/* Controls */}
      <StackItem>
        <Toolbar>
          <ToolbarContent>
            <ToolbarGroup variant="filter-group">
              <ToolbarItem>
                <SearchInput
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(_event, value) => setSearchTerm(value)}
                />
              </ToolbarItem>
              <ToolbarFilter categoryName={'Status'}>
                <Select
                  placeholder="Filter by status"
                  selections={statusFilter}
                  onSelect={(_event, value) => setStatusFilter(value as JobStatus | 'all')}
                  isOpen={isStatusFilterOpen} 
                  onToggle={(event: ToggleEvent<HTMLDivElement>, isOpen: boolean) => setIsStatusFilterOpen(isOpen)}
                >
                  <SelectOption value="all">All</SelectOption>
                  <SelectOption value="pending">Pending</SelectOption>
                  <SelectOption value="printing">Printing</SelectOption>
                  <SelectOption value="completed">Completed</SelectOption>
                  <SelectOption value="failed">Failed</SelectOption>
                </Select>
              </ToolbarFilter>
              <ToolbarItem>
                <Select
                  placeholder="Sort by"
                  selections={sortBy}
                  onSelect={(_event: React.MouseEvent | React.ChangeEvent | React.FormEvent<HTMLInputElement>, value: string) => setSortBy(value as 'createdAt' | 'name' | 'estimatedTime')}
                  isOpen={isSortByOpen}
                  onToggle={(event: boolean, isOpen: boolean) => setIsSortByOpen(isOpen)}
                >
                  <SelectOption value="createdAt">Created At</SelectOption>
                  <SelectOption value="name">Name</SelectOption>
                  <SelectOption value="estimatedTime">Estimated Time</SelectOption>
                </Select>
              </ToolbarItem>
              <ToolbarItem>
                <Button
                  variant="plain"
                  onClick={toggleSortOrder}
                  aria-label={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
              </ToolbarItem>
            </ToolbarGroup>
            {onRefresh && (
              <ToolbarItem>
                <Button
                  variant="plain"
                  onClick={onRefresh}
                  aria-label="Refresh Queue"
                  icon={<SyncIcon />}
                />
              </ToolbarItem>
            )}
          </ToolbarContent>
        </Toolbar>
      </StackItem>

      {/* Active Jobs */}
      <StackItem>
        <Title headingLevel="h2" size={TitleSizes.lg}>Active Jobs</Title>
        {activeJobs.length === 0 ? renderEmptyState('No active jobs') : (
          <Stack hasGutter>
            {activeJobs.map(job => (
              <StackItem key={job.id}>
                <Job
                  job={job}
                  onClick={() => onSelectJob && onSelectJob(job.id)}
                  actions={
                    <Flex>
                      {job.status === 'printing' ? (
                        <Button
                          variant="plain"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPauseJob(job.id);
                          }}
                          icon={<PauseIcon />}
                          aria-label="Pause"
                        />
                      ) : (
                        <Button
                          variant="plain"
                          onClick={(e) => {
                            e.stopPropagation();
                            onResumeJob(job.id);
                          }}
                          icon={<PlayIcon />}
                          aria-label="Resume"
                        />
                      )}
                      <Button
                        variant="plain"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancelJob(job.id);
                        }}
                        icon={<TimesCircleIcon />}
                        aria-label="Cancel"
                      />
                    </Flex>
                  }
                />
              </StackItem>
            ))}
          </Stack>
        )}
      </StackItem>

      {/* Pending Queue */}
      <StackItem>
        <Title headingLevel="h2" size={TitleSizes.lg}>Pending Queue</Title>
        {pendingJobs.length === 0 ? renderEmptyState('No pending jobs') : (
          <Stack hasGutter>
            {pendingJobs.map((job, index) => (
              <StackItem key={job.id}>
                <Job
                  job={job}
                  onClick={() => onSelectJob && onSelectJob(job.id)}
                  actions={
                    <Flex>
                      {availablePrinters.length > 0 && (
                        <Dropdown
                          toggle={(toggleRef: React.RefObject<any>) => (
                            <DropdownToggle onToggle={(isOpen: boolean) => setIsPrinterDropdownOpen(isOpen)} ref={toggleRef}>
                              {selectedPrinter ? selectedPrinter.name : 'Select printer'}
                            </DropdownToggle>
                          )}
                          isOpen={isPrinterDropdownOpen}
                          dropdownItems={availablePrinters.map(printer => (
                            <DropdownItem key={printer.id} onClick={() => setSelectedPrinter(printer)}>
                              {printer.name}
                            </DropdownItem>
                          ))}
                          position="right"
                        />
                      )}
                      <Button
                        variant="plain"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveJobUp(job.id);
                        }}
                        isDisabled={index === 0}
                        icon={<ArrowUpIcon />}
                        aria-label="Move up"
                      />
                      <Button
                        variant="plain"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveJobDown(job.id);
                        }}
                        isDisabled={index === pendingJobs.length - 1}
                        icon={<ArrowDownIcon />}
                        aria-label="Move down"
                      />
                    </Flex>
                  }
                />
              </StackItem>
            ))}
          </Stack>
        )}
      </StackItem>

      {/* Completed Jobs */}
      <StackItem>
        <Title headingLevel="h2" size={TitleSizes.lg}>Completed Jobs</Title>
        {completedJobs.length === 0 ? renderEmptyState('No completed jobs') : (
          <Stack hasGutter>
            {completedJobs.map(job => (
              <StackItem key={job.id}>
                <Job
                  job={job}
                  onClick={() => onSelectJob && onSelectJob(job.id)}
                />
              </StackItem>
            ))}
          </Stack>
        )}
      </StackItem>
    </Stack>
  );
};

export default QueueManagement; 