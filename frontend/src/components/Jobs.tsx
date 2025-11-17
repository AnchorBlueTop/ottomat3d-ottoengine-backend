import React, { useContext, useEffect, useState } from 'react';
import { JobContext } from '../App';
import uploadPrintFile from './modals/UploadPrintFile';
import AddNewPrintJobButton from './buttons/addNewPrintJobButton';
import StartPrintJobsButton from './buttons/startPrintJobButton';
import newJobQueue from './modals/newJobQueue';
import { getAllPrintJobs } from '../ottoengine_API';
import PrintJobModal from './modals/PrintJobModal';
import {
  Grid, GridItem, PageSection, Label,
  DataList, DataListItem, DataListItemRow, DataListItemCells, DataListCell
} from '@patternfly/react-core';
import { PlayIcon } from '@patternfly/react-icons';
import PrintJobProgress from './printJobProgress';
import hourglass from '../public/hourglass.png';
import printerIcon from '../public/printer-Icon.svg';
import rackIcon from '../public/ottorack-icon.png';

export const Job: React.FunctionComponent = () => {
  const { printJob, setPrintJob, setPrintJobIndex, setPrintJobUID, setIsEditPrintJobModalOpen, ottorack } = useContext(JobContext);
  const [loading, setLoading] = useState(true);

  const fetchPrintJobs = async () => {
    try {
      setLoading(true);
      const allPrintJobs = await getAllPrintJobs();
      setPrintJob(allPrintJobs);
    } catch (error) {
      console.error("Failed to fetch print jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Map status to our custom solid pill class
  const statusClass = (status?: string) => {
    switch ((status || '').toUpperCase()) {
      case 'NEW':
      case 'READY':
        return 'pf-custom-label pf-custom-label--ready';
      case 'QUEUED':
        return 'pf-custom-label pf-custom-label--queued';
      case 'PRINTING':
        return 'pf-custom-label pf-custom-label--printing';
      case 'EJECTED':
        return 'pf-custom-label pf-custom-label--ejected';
      case 'COMPLETE':
      case 'FINISHED':
        return 'pf-custom-label pf-custom-label--complete';
      case 'ERROR':
        return 'pf-custom-label pf-custom-label--error';
      default:
        return 'pf-custom-label pf-custom-label--default';
    }
  };

  const openEdit = (jobId?: number, idx?: number) => {
    if (!jobId) return;
    if (typeof idx === 'number') setPrintJobIndex(idx);
    setPrintJobUID(jobId);
    setIsEditPrintJobModalOpen(true);
  };

  const printJobList = () => {
    if (!printJob) return null;

    return (
      <PageSection isWidthLimited>
        <DataList aria-label="jobs-list" isCompact>
          {printJob.map((value, rowIndex) => {
            const fileDetails = JSON.parse(value.file_details_json || '{}') || {};
            const durationText = value.duration || fileDetails.duration || '-';
            const printerText = value.printer_id || fileDetails.printer || '-';
            // Map assigned_rack_id to a human-readable rack name from context (fallback to id or '-')
            const rackId = (value as any)?.assigned_rack_id ?? fileDetails.assigned_rack_id;
            const rackText = rackId != null && rackId !== ''
              ? (ottorack?.find(r => String(r.id) === String(rackId))?.name || String(rackId))
              : '-';
            const status = String(value?.status || '').toUpperCase();
            const showProgress = status === 'PRINTING' || status === 'COMPLETE' || status === 'FINISHED';

            return (
              <DataListItem key={value.id ?? rowIndex} aria-labelledby={`job-${value.id}`}>
                <DataListItemRow
                  onClick={() => openEdit(value.id, rowIndex)}
                  className="pf-u-align-items-center pf-u-py-0 clickable-job-row"
                  style={{ minHeight: 56, cursor: 'pointer' }}
                >
                  <DataListItemCells
                    className='pf-custom-align-center-horizontally'
                    dataListCells={[
                      // ID + Filename (content-sized)
                      <DataListCell key="id-name" isFilled={!showProgress} className="pf-u-display-flex pf-u-flex-direction-column pf-u-justify-content-center pf-u-align-items-flex-start">
                        <div className="pf-u-font-weight-bold" id={`job-${value.id}`}>{value.id ?? '-'}</div>
                        <div className="pf-u-color-200">{fileDetails.name || '-'}</div>
                      </DataListCell>,

                      // Status (content-sized)
                      <DataListCell key="status" isFilled={!showProgress} className="pf-u-display-flex pf-u-justify-content-center pf-u-align-items-center content-center-align">
                        <Label className={statusClass(value.status)}>{String(value.status || 'Unknown').toUpperCase()}</Label>
                      </DataListCell>,

                      // Printer (content-sized)
                      <DataListCell
                        key="printer"
                        isFilled={!showProgress}
                        className="pf-u-display-flex pf-u-flex-direction-column pf-u-justify-content-center pf-u-align-items-flex-start pf-u-text-align-left"
                        style={{ textAlign: 'left' }}
                      >
                        {!showProgress ? (
                          <div className="pf-u-w-100 pf-u-text-align-left" style={{ textAlign: 'left' }}>
                            <div className="pf-u-font-weight-bold pf-custom-duration" style={{ alignSelf: 'flex-start', display: 'block' }}>
                              <img src={printerIcon} alt="" className="pf-custom-duration-icon pf-custom-purple-filter" />
                              {' Printer: ' + printerText}
                            </div>
                            <div className="pf-u-font-weight-bold pf-custom-duration" style={{ alignSelf: 'flex-start', display: 'block' }}>
                              <img src={rackIcon} alt="" className="pf-custom-duration-icon pf-custom-purple-filter" />
                              {' Rack: ' + rackText}
                            </div>
                          </div>
                        ) : (
                          <div className="pf-u-w-100 pf-u-text-align-left" style={{ textAlign: 'left' }}>
                            <div className="pf-u-font-weight-bold pf-custom-duration" style={{ alignSelf: 'flex-start', display: 'block' }}>
                              <img src={printerIcon} alt="" className="pf-custom-duration-icon pf-custom-purple-filter" />
                              {' Printer: ' + printerText}
                            </div>
                            <div className="pf-u-font-weight-bold pf-custom-duration" style={{ alignSelf: 'flex-start', display: 'block' }}>
                              <img src={rackIcon} alt="" className="pf-custom-duration-icon pf-custom-purple-filter" />
                              {' Rack: ' + rackText}
                            </div>
                          </div>
                        )}
                      </DataListCell>,

                      // Duration (hide label when progress is shown; value is moved above the bar)
                      <DataListCell key="duration" isFilled={!showProgress} className="pf-u-display-flex pf-u-flex-direction-column pf-u-justify-content-center">
                        {!showProgress ? (
                          <>
                            <div className="pf-u-font-weight-bold pf-custom-duration">
                              <img src={hourglass} alt="" className="pf-custom-duration-icon" />
                              Duration
                            </div>
                            <div className="pf-u-color-200">{durationText}</div>
                          </>
                        ) : null}
                      </DataListCell>,

                      // Progress (fills remaining space, centered) with duration value above bar when present
                      <DataListCell key="progress" isFilled className="pf-custom-progress-cell">
                        <div className="pf-custom-progress-wrapper" onClick={(e) => e.stopPropagation()}>
                          {showProgress ? (
                            <div className="pf-custom-progress-duration pf-custom-duration">
                              <img src={hourglass} alt="" className="pf-custom-duration-icon" />
                              <span>{durationText}</span>
                            </div>
                          ) : null}
                          <PrintJobProgress job={value} showWhen="printing-or-complete" size="sm" showEta={true} />
                        </div>
                      </DataListCell>,

                      // Actions (content-sized, right-aligned, vertically centered)
                      <DataListCell key="actions" isFilled={false} className="pf-u-display-flex pf-u-align-items-center">
                        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                          {value.id ? (
                            <StartPrintJobsButton 
                              jobId={value.id} 
                              variant="plain"
                              jobStatus={value.status}
                              printerId={value.printer_id}
                            >
                              <PlayIcon />
                            </StartPrintJobsButton>
                          ) : null}
                        </div>
                      </DataListCell>,
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
            );
          })}
        </DataList>
      </PageSection>
    );
  };

  useEffect(() => {
    fetchPrintJobs();
  }, []);

  return (
    <>
      <Grid>
        <GridItem rowSpan={1}>
          <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
            {/* {StartPrintJobsButton()} */}
            {AddNewPrintJobButton()}
          </PageSection>
        </GridItem>
        <GridItem>
          <PageSection id="dashboard" className="pf-custom-dashboard">
            {loading ? <p>Loading print jobs...</p> : printJob.length > 0 ? printJobList() : <p>No print jobs available.</p>}
          </PageSection>
        </GridItem>
      </Grid>
      {newJobQueue()}
      {PrintJobModal()}
      {uploadPrintFile()}
    </>
  );
};
