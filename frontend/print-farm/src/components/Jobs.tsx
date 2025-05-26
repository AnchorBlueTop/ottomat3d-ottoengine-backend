import React, { useContext } from 'react';
import { JobContext } from '../App';
import addPrintTask from '../AddPrintTask';
import newPrintJob from '../newPrintJob';
import { Grid, GridItem, PageSection, Button, List, ListItem } from '@patternfly/react-core';
import AddNewPrintJobButton from './buttons/addNewPrintJobButton';
import { Tr, Td, Table, Tbody, Th, Thead } from '@patternfly/react-table';
// import { ClockIcon, LayersIcon, PrinterIcon, CheckCircleIcon, AlertCircleIcon, PauseIcon } from 'lucide-react';
// interface JobProps {
//   job: PrintJob;
//   onClick?: () => void;
//   actions?: React.ReactNode;
// }
export const Job = () => {
  const { printJob, setPrintJobIndex } = useContext(JobContext);

  const printJobList = () => {
    if (printJob) {
      return (
        <>
        <Table>
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Name</Th>
              <Th>Printer</Th>
              <Th>Model</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {printJob.map((value, index) => (
              <Tr
                key={index}
                onClick={() => {
                  setPrintJobIndex(index)
                  // setIsPrinterEditModalOpen(true)
                }}
              >
                <Td>{value.id}</Td>
                <Td>{value.name}</Td>
                <Td>{value.printer}</Td>
                <Td>{value.duration}</Td>
                <Td>{value.status}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        </>
      )
    }
  };
  
  return (
    <>
      <Grid>
        <GridItem rowSpan={1}>
            <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                {AddNewPrintJobButton()}
            </PageSection>
        </GridItem>

        <GridItem>
            <PageSection id='dashboard' className="pf-custom-dashboard">
                  {/* {printJobList()} */}
                  {printJob.length > 0 ? printJobList() : ''}
            </PageSection>
        </GridItem>
      </Grid>
      
      {newPrintJob()}
      {addPrintTask()}
    </>
  );
};