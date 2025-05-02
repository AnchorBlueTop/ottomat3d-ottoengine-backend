import React, { useContext } from 'react';
import { JobContext, PrintJob } from '../App';
import addPrintTask from '../AddPrintTask';
import newPrintJob from '../newPrintJob';
import { Grid, GridItem, PageSection, Button } from '@patternfly/react-core';
// import { ClockIcon, LayersIcon, PrinterIcon, CheckCircleIcon, AlertCircleIcon, PauseIcon } from 'lucide-react';
// interface JobProps {
//   job: PrintJob;
//   onClick?: () => void;
//   actions?: React.ReactNode;
// }
export const Job = () => {
  const { setIsFileUploadModalOpen } = useContext(JobContext);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'printing':
        return 'bg-green-500';
      case 'pending':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-gray-500';
      case 'failed':
        return 'bg-red-500';
      case 'paused':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'printing':
        // return <PrinterIcon size={14} />;
      case 'pending':
        // return <ClockIcon size={14} />;
      case 'completed':
        // return <CheckCircleIcon size={14} />;
      case 'failed':
        // return <AlertCircleIcon size={14} />;
      case 'paused':
        // return <PauseIcon size={14} />;
      default:
        // return <ClockIcon size={14} />;
    }
  };
  // return <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer flex" onClick={onClick}>
  //     {job.thumbnailUrl && <div className="w-16 h-16 mr-4 flex-shrink-0">
  //         <img src={job.thumbnailUrl} alt={job.name} className="w-full h-full object-cover rounded" />
  //       </div>}
  //     <div className="flex-1">
  //       <div className="flex justify-between items-start">
  //         <div>
  //           <h3 className="font-medium text-gray-900">{job.name}</h3>
  //           <p className="text-sm text-gray-500">{job.fileName}</p>
  //         </div>
  //         <div className="flex items-center">
  //           <span className={`flex items-center px-2 py-1 text-xs rounded text-white ${getStatusColor(job.status)}`}>
  //             {/* {getStatusIcon(job.status)} */}
  //             <span className="ml-1 capitalize">{job.status}</span>
  //           </span>
  //         </div>
  //       </div>
  //       <div className="mt-2 flex items-center text-sm text-gray-600">
  //         {/* <LayersIcon size={14} className="mr-1" /> */}
  //         <span className="mr-3">
  //           {job.filamentType} {job.filamentColor}
  //         </span>
  //         {/* <ClockIcon size={14} className="mr-1" /> */}
  //         <span>
  //           {Math.floor(job.estimatedTime / 60)}h {job.estimatedTime % 60}m
  //         </span>
  //       </div>
  //       {job.status === 'printing' && <div className="mt-2">
  //           <div className="w-full bg-gray-200 rounded-full h-2">
  //             <div className="bg-blue-600 h-2 rounded-full" style={{
  //           width: `${job.progress}%`
  //         }} />
  //           </div>
  //           <div className="mt-1 text-xs text-gray-500 flex justify-between">
  //             <span>{job.progress}% complete</span>
  //             <span>
  //               {Math.floor(job.estimatedTime * (100 - job.progress) / 100 / 60)}
  //               h
  //               {Math.round(job.estimatedTime * (100 - job.progress) / 100 % 60)}
  //               m remaining
  //             </span>
  //           </div>
  //         </div>}
  //     </div>
  //     {actions && <div className="ml-4 flex items-center">{actions}</div>}
  //   </div>;

    return (
      <>
        <Grid>
          <GridItem rowSpan={1}>
              <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                  <Button 
                      id="add-print-button" 
                      className="pf-custom-add-print-button"
                      onClick={() => setIsFileUploadModalOpen(true)}
                  >
                      {'+ Add'}
                  </Button>
              </PageSection>
          </GridItem>

          <GridItem>
              <PageSection id='dashboard' className="pf-custom-dashboard">
                  {/* {newPrintJob()}
                  {addPrintTask()} */}
                  {/* {workflow()} */}
              </PageSection>
          </GridItem>
        </Grid>
        
        {newPrintJob()}
        {addPrintTask()}
      </>
    );  
};