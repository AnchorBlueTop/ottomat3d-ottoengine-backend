import {
  // Button,
  Page,
  PageSection,
  // PageSection
} from "@patternfly/react-core";
// import './App.css';
import React, { createContext, ReactNode, useContext, useState } from "react";
// import { moonraker } from "./listAPI";
import { PageHeader } from "./Page-Header";
// import addPrintTask from "./AddPrintTask";
import Dashboard from "./components/Dashboard";
import loadAPI from "./loadAPI";
import APILoader from "./loadAPI";
import {PrinterRegistrationRepresentation, PrinterRepresentation} from "./representations/printerRepresentation";
import readFile from "./representations/readFileRepresentation";

import { Printers } from "./components/Printers";
import { Layout } from "./Layout";
import { QueueManagement } from "./components/QueueManagement";
import './App.css';
import { OttoejectDevice } from "./representations/ottoejectRepresentation";
import PrintJobRepresentation from "./representations/printJobRepresentation";


interface Props {
  children: ReactNode;
}

//FROM GEN
// export type JobStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'paused';
// export interface PrintJob {
//   id?: string;
//   name?: string;
//   fileName?: string;
//   filamentType?: string;
//   filamentColor?: string;
//   estimatedTime?: number; // in minutes
//   progress?: number; // 0-100
//   status?: JobStatus;
//   printer?: string;
//   createdAt?: Date;
//   startedAt?: Date;
//   completedAt?: Date;
//   thumbnailUrl?: string;
//   settings?: {
//     layerHeight: number;
//     infill: number;
//     supportEnabled: boolean;
//     temperature: number;
//     bedTemperature: number;
//   };
// }


type ContextType = {
  //Original old
  printer: PrinterRepresentation[];
  setPrinter: React.Dispatch<React.SetStateAction<PrinterRepresentation[]>>;
  ottoeject: OttoejectDevice[];
  setOttoeject: React.Dispatch<React.SetStateAction<OttoejectDevice[]>>;
  printTaskModalOpen: boolean;
  setIsPrintTaskModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileUploadModalOpen: boolean;
  setIsFileUploadModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  printerAddModalOpen: boolean;
  setIsPrinterAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ottoejectAddModalOpen: boolean;
  setIsOttoejectAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ottoejectEditModalOpen: boolean;
  setIsOttoejectEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentFiles: any[];
  setCurrentFiles: React.Dispatch<React.SetStateAction<any[]>>;
  printerEditModalOpen: boolean;
  setIsPrinterEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  printerIndex: number|undefined;
  setPrinterIndex: React.Dispatch<React.SetStateAction<number|undefined>>;
  ottoejectIndex: number|undefined;
  setOttoejectIndex: React.Dispatch<React.SetStateAction<number|undefined>>;
  printJob: PrintJobRepresentation[];
  setPrintJob: React.Dispatch<React.SetStateAction<PrintJobRepresentation[]>>;
  printJobIndex: number|undefined;
  setPrintJobIndex: React.Dispatch<React.SetStateAction<number|undefined>>;
  printFile: any|undefined;
  setPrintFile: React.Dispatch<React.SetStateAction<any|undefined>>;
  

// FROM GEN
  // jobs: PrintJob[];
  // // printers: Printer[];
  // // printers: printerRepresentation[];
  // addJob: (job: Omit<PrintJob, 'id' | 'createdAt' | 'progress'>) => void;
  // updateJob: (id: string, updates: Partial<PrintJob>) => void;
  // removeJob: (id: string) => void;
  // getJob: (id: string) => PrintJob | undefined;
  // moveJobUp: (id: string) => void;
  // moveJobDown: (id: string) => void;
  // startJob: (id: string, printerId: string) => void;
  // pauseJob: (id: string) => void;
  // resumeJob: (id: string) => void;
  // cancelJob: (id: string) => void;
}

export const JobContext = createContext<ContextType>({} as ContextType);

// FROM GEM
// const sampleJobs: PrintJob[] = [];

export const JobContextProvider: React.FC<Props> = ({children}) => {

  const [printTaskModalOpen, setIsPrintTaskModalOpen] = useState(false);
  const [fileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [printerAddModalOpen, setIsPrinterAddModalOpen] = useState(false);
  const [printerEditModalOpen, setIsPrinterEditModalOpen] = useState(false);
  const [ottoejectAddModalOpen, setIsOttoejectAddModalOpen] = useState(false);
  const [ottoejectEditModalOpen, setIsOttoejectEditModalOpen] = useState(false);
  const [printerIndex, setPrinterIndex] = useState<number|undefined>();
  const [ottoejectIndex, setOttoejectIndex] = useState<number|undefined>();
  const [printer, setPrinter] = useState<any|undefined>([]);
  const [currentFiles, setCurrentFiles] = useState<any[]>([]);
  const [printJob, setPrintJob] = useState<PrintJobRepresentation[]>([]);
  const [printJobIndex, setPrintJobIndex] = useState<number|undefined>();
  const [ottoeject, setOttoeject] = useState<OttoejectDevice[]>([]);
  const [printFile, setPrintFile] = useState<any|undefined>();

  // FROM GEN
  // const [jobs, setJobs] = useState<PrintJob[]>([]);
  // // const [printers, setPrinters] = useState<Printer[]>([]);
  // const addJob = (job: Omit<PrintJob, 'id' | 'createdAt' | 'progress'>) => {
  //   const newJob: PrintJob = {
  //     ...job,
  //     id: Date.now().toString(),
  //     createdAt: new Date(),
  //     progress: 0
  //   };
  //   setJobs([...jobs, newJob]);
  // };
  // const updateJob = (id: string, updates: Partial<PrintJob>) => {
  //   setJobs(jobs.map(job => job.id === id ? {
  //     ...job,
  //     ...updates
  //   } : job));
  // };
  // const removeJob = (id: string) => {
  //   setJobs(jobs.filter(job => job.id !== id));
  // };
  // const getJob = (id: string) => {
  //   return jobs.find(job => job.id === id);
  // };
  // const moveJobUp = (id: string) => {
  //   const index = jobs.findIndex(job => job.id === id);
  //   if (index <= 0) return;
  //   const newJobs = [...jobs];
  //   const temp = newJobs[index];
  //   newJobs[index] = newJobs[index - 1];
  //   newJobs[index - 1] = temp;
  //   setJobs(newJobs);
  // };
  // const moveJobDown = (id: string) => {
  //   const index = jobs.findIndex(job => job.id === id);
  //   if (index === -1 || index >= jobs.length - 1) return;
  //   const newJobs = [...jobs];
  //   const temp = newJobs[index];
  //   newJobs[index] = newJobs[index + 1];
  //   newJobs[index + 1] = temp;
  //   setJobs(newJobs);
  // };
  // const startJob = (id: string, printerId: string) => {
  //   // Update job status
  //   setJobs(jobs.map(job => job.id === id ? {
  //     ...job,
  //     status: 'printing',
  //     startedAt: new Date(),
  //     printer: printerId
  //   } : job));
  //   // Update printer status
  //   setPrinter(printer.map((printer:any) => printer.id === printerId ? {
  //     ...printer,
  //     status: 'printing',
  //     currentJob: id
  //   } : printer));
  // };
  // const pauseJob = (id: string) => {
  //   const job = jobs.find(j => j.id === id);
  //   if (!job) return;
  //   // Update job status
  //   setJobs(jobs.map(job => job.id === id ? {
  //     ...job,
  //     status: 'paused'
  //   } : job));
  // };
  // const resumeJob = (id: string) => {
  //   const job = jobs.find(j => j.id === id);
  //   if (!job) return;
  //   // Update job status
  //   setJobs(jobs.map(job => job.id === id ? {
  //     ...job,
  //     status: 'printing'
  //   } : job));
  // };
  // const cancelJob = (id: string) => {
  //   const job = jobs.find(j => j.id === id);
  //   if (!job || job.status !== 'printing') return;
  //   // Update job status
  //   setJobs(jobs.map(job => job.id === id ? {
  //     ...job,
  //     status: 'failed'
  //   } : job));
  //   // Update printer status
  //   setPrinter(printer.map((printer:any) => printer.currentJob === id ? {
  //     ...printer,
  //     status: 'idle',
  //     currentJob: undefined
  //   } : printer));
  // };

  return <JobContext.Provider value={{
    // jobs,
    // // printers,
    // addJob,
    // updateJob,
    // removeJob,
    // getJob,
    // moveJobUp,
    // moveJobDown,
    // startJob,
    // pauseJob,
    // resumeJob,
    // cancelJob,

    printTaskModalOpen,
    setIsFileUploadModalOpen,
    fileUploadModalOpen,
    setIsPrintTaskModalOpen,
    printerAddModalOpen, 
    setIsPrinterAddModalOpen,
    ottoejectAddModalOpen, 
    setIsOttoejectAddModalOpen,
    ottoejectEditModalOpen,
    setIsOttoejectEditModalOpen,
    printer,
    setPrinter,
    ottoeject, 
    setOttoeject,
    currentFiles,
    setCurrentFiles,
    printerEditModalOpen,
    setIsPrinterEditModalOpen,
    printerIndex, 
    setPrinterIndex, 
    ottoejectIndex, 
    setOttoejectIndex, 
    printJob, 
    setPrintJob, 
    printJobIndex,
    setPrintJobIndex, 
    printFile,
    setPrintFile
  }}>
    {children}
  </JobContext.Provider>;



  // const [printer, setPrinter] = useState<any|undefined>();
  // const [printTaskModalOpen, setIsPrintTaskModalOpen] = useState(false);
  // const [fileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  // const [currentFiles, setCurrentFiles] = useState<File[]>([]);



  // return <JobContext.Provider value = {
  //   {
  //     printer, setPrinter, 
  //     printTaskModalOpen, setIsPrintTaskModalOpen,
  //     fileUploadModalOpen, setIsFileUploadModalOpen,
  //     currentFiles, setCurrentFiles
  //   }}>{children}</JobContext.Provider>
}

export const useQueue = () => {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<any>('dashboard');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null);

  const renderContent = () => {
    switch (activeTab) {
      case 'printers':
        return <Printers />;
      case 'queue':
        return <QueueManagement onSelectJob={setSelectedJob} />;
      case 'job':
        // return selectedJob ? <JobDetails job={selectedJob} /> : <QueueManagement onSelectJob={setSelectedJob} />;
      default:
        return <Printers />;
    }
  };
  return (
    <JobContextProvider>
      <PageSection className="App">
        <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
          {renderContent()}
        </Layout>
      </PageSection>
    </JobContextProvider>
  );

// OLD
  // return (
  //   <JobContextProvider>
  //       <div className="App">
  //         <Page masthead={<PageHeader/>}>

  //           <Dashboard/>
  //         </Page>
  //       </div>
  //   </JobContextProvider>

  // )



}
