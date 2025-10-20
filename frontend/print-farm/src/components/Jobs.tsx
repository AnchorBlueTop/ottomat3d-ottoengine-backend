import React, { useContext, useEffect, useState } from 'react';
import { JobContext } from '../App';
import uploadPrintFile from './modals/UploadPrintFIle';
import newPrintJob from './modals/newPrintJob';
import { Grid, GridItem, PageSection } from '@patternfly/react-core';
import AddNewPrintJobButton from './buttons/addNewPrintJobButton';
import { Tr, Td, Table, Tbody, Th, Thead } from '@patternfly/react-table';
import PrintJobRepresentation from '../representations/printJobRepresentation';
import StartPrintJobsButton from './buttons/startPrintJobButton';
import newJobQueue from './modals/newJobQueue';
import { getAllPrintJobs } from '../ottoengine_API';

export const Job: React.FunctionComponent = () => {
  const { printJob, setPrintJob, setPrintJobIndex, setSelectedJobIDs, selectedJobIDs, queue } = useContext(JobContext);
  const [loading, setLoading] = useState(true); // Default to true while fetching

  const isJobSelectable = (printjob: PrintJobRepresentation) => printjob.id !== undefined; // Arbitrary logic for this example
  const selectableJobs = printJob.filter(isJobSelectable);
  const setJobSelected = (printjob: PrintJobRepresentation, isSelecting = true) =>
    setSelectedJobIDs((prevSelected: any) => {
      const otherSelectedJobIDs = prevSelected.filter((r: any) => r !== printjob.id);
      return isSelecting && isJobSelectable(printjob) ? [...otherSelectedJobIDs, printjob.id] : otherSelectedJobIDs;
    });
    const selectAllJobs = (isSelecting = true) =>
      setSelectedJobIDs(isSelecting ? selectableJobs.map((r:any) => r.name) : []);
    const areAllReposSelected = selectedJobIDs.length === selectableJobs.length;
    const isJobSelected = (printJob: PrintJobRepresentation) => selectedJobIDs.includes(printJob.id!);

  // To allow shift+click to select/deselect multiple rows
  const [recentSelectedRowIndex, setRecentSelectedRowIndex] = useState<number | null>(null);
  const [shifting, setShifting] = useState(false);

  const onSelectRepo = (printjob: PrintJobRepresentation, rowIndex: number, isSelecting: boolean) => {
    // If the user is shift + selecting the checkboxes, then all intermediate checkboxes should be selected
    if (shifting && recentSelectedRowIndex !== null) {
      const numberSelected = rowIndex - recentSelectedRowIndex;
      const intermediateIndexes =
        numberSelected > 0
          ? Array.from(new Array(numberSelected + 1), (_x, i) => i + recentSelectedRowIndex)
          : Array.from(new Array(Math.abs(numberSelected) + 1), (_x, i) => i + rowIndex);
      intermediateIndexes.forEach((index) => setJobSelected(printJob[index], isSelecting));
    } else {
      setJobSelected(printjob, isSelecting);
    }
    setRecentSelectedRowIndex(rowIndex);
  };
  const fetchPrintJobs = async () => {
    try {
      setLoading(true); // Start loading
      const allPrintJobs = await getAllPrintJobs(); // Fetch all print jobs
      setPrintJob(allPrintJobs); // Update the state with the fetched jobs
    } catch (error) {
      console.error("Failed to fetch print jobs:", error);
    } finally {
      setLoading(false); // Stop loading
    }
  };

  const printJobList = () => {
    if (printJob) {
      return (
        <PageSection isWidthLimited>
          <Table className='pf-c-table'>
            <Thead aria-label='print-job-table'>
              <Tr>
                {/* <Th
                select={{
                  onSelect: (_event, isSelecting) => selectAllRepos(isSelecting),
                  isSelected: areAllReposSelected
                }}
                aria-label="Row select"
              /> */}
                <Th width={10} aria-label='print-job-table-selectable' />
                <Th width={10} aria-label='print-job-table-status'>{'Status'}</Th>
                <Th width={10} aria-label='print-job-table-id'>{'ID'}</Th>
                <Th width={30} aria-label='print-job-table-name'>{'Filename'}</Th>
                <Th width={15} aria-label='print-job-table-printer'>{'Printer'}</Th>
                <Th width={15} aria-label='print-job-table-duration'>{'Print Duration'}</Th>
                <Th width={15} aria-label='print-job-table-time-remaining'>{'Time Remaining'}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {printJob.map((value, rowIndex) => {
                const fileDetails = JSON.parse(value.file_details_json || '{}');
                const measurementDetails = JSON.parse(value.measurement_details_json || '{}');
                const filamentDetails = JSON.parse(value.filament_details_json || '{}');
                return (
                <Tr
                  className='pf-c-printJob-table-row'
                  key={rowIndex}
                  onClick={() => {
                    setPrintJobIndex(rowIndex)
                    // TODO: SETUP EDIT PRINT JOB
                    // setIsPrinterEditModalOpen(true)
                  }}
                >
                  <Td width={10}
                    select={{
                      rowIndex,
                      onSelect: (_event, isSelecting) => onSelectRepo(value, rowIndex, isSelecting),
                      isSelected: isJobSelected(value),
                      isDisabled: !isJobSelectable(value)
                    }}
                  />
                  {/* <Td>{<ReadyLabel/>}</Td> */}
                  {/* <Td>{value.status || 'N/A'}</Td>
                  <Td>{value.id || 'N/A'}</Td>
                  <Td>{value.name || 'Unnamed Job'}</Td>
                  <Td>{value.printer || 'No Printer Assigned'}</Td>
                  <Td>{value.duration || 'Unknown Duration'}</Td>
                  <Td>{value.remaining_time || 'Unknown Time Remaining'}</Td> */}
                  <Td>{value.status || 'N/A'}</Td>
                  <Td>{value.id || 'N/A'}</Td>
                  <Td>{fileDetails.name || 'Unnamed File'}</Td>
                  <Td>{value.printer_id || 'No Printer Assigned'}</Td>
                  <Td>{value.duration || 'Unknown Duration'}</Td>
                  {/* <Td>{value.status_message || 'No Status Message'}</Td> */}
                </Tr>
                )
    })}
            </Tbody>
          </Table>
        </PageSection>
      )
    }
  };



  useEffect(() => {
    fetchPrintJobs();
  }, [queue]);

  return (
    <>
      <Grid>
        <GridItem rowSpan={1}>
          <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
            {StartPrintJobsButton()}
            {AddNewPrintJobButton()}
          </PageSection>
        </GridItem>

        <GridItem>
          <PageSection id="dashboard" className="pf-custom-dashboard">
            {loading ? (
              <p>Loading print jobs...</p> // Render a loading message or spinner
            ) : printJob.length > 0 ? (
              printJobList() // Render the table if jobs are available
            ) : (
              <p>No print jobs available.</p> // Render a message if no jobs are found
            )}
          </PageSection>
        </GridItem>
      </Grid>
      {newJobQueue()}
      {newPrintJob()}
      {uploadPrintFile()}
    </>
  );
};