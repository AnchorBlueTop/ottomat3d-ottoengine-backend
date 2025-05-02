import {
  // Button,
  Page,
  PageSection,
  // PageSection
} from "@patternfly/react-core";
import './App.css';
import React, { createContext, ReactNode, useContext, useState } from "react";
// import { moonraker } from "./listAPI";
import { PageHeader } from "./Page-Header";
// import addPrintTask from "./AddPrintTask";
import Dashboard from "./components/Dashboard";
import loadAPI from "./loadAPI";
import APILoader from "./loadAPI";
import printerRepresentation from "./printerRepresentation";
import readFile from "./readFileRepresentation";

import { Printers } from "./components/Printers";
import { Layout } from "./Layout";
import { QueueManagement } from "./components/QueueManagement";

interface Props {
  children: ReactNode;
}

//FROM GEN
export type JobStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'paused';
export interface PrintJob {
  id?: string;
  name?: string;
  fileName?: string;
  filamentType?: string;
  filamentColor?: string;
  estimatedTime?: number; // in minutes
  progress?: number; // 0-100
  status?: JobStatus;
  printer?: string;
  createdAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  thumbnailUrl?: string;
  settings?: {
    layerHeight: number;
    infill: number;
    supportEnabled: boolean;
    temperature: number;
    bedTemperature: number;
  };
}
interface Printer {
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

type ContextType = {
  //Original old
  printer: printerRepresentation[];
  setPrinter: React.Dispatch<React.SetStateAction<printerRepresentation[]>>;
  printTaskModalOpen: boolean;
  setIsPrintTaskModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileUploadModalOpen: boolean;
  setIsFileUploadModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  printerAddModalOpen: boolean;
  setIsPrinterAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentFiles: File[];
  setCurrentFiles: React.Dispatch<React.SetStateAction<File[]>>;
  printerEditModalOpen: boolean;
  setIsPrinterEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  printerIndex: number|undefined;
  setPrinterIndex: React.Dispatch<React.SetStateAction<number|undefined>>;

// FROM GEN
  jobs: PrintJob[];
  // printers: Printer[];
  // printers: printerRepresentation[];
  addJob: (job: Omit<PrintJob, 'id' | 'createdAt' | 'progress'>) => void;
  updateJob: (id: string, updates: Partial<PrintJob>) => void;
  removeJob: (id: string) => void;
  getJob: (id: string) => PrintJob | undefined;
  moveJobUp: (id: string) => void;
  moveJobDown: (id: string) => void;
  startJob: (id: string, printerId: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
  cancelJob: (id: string) => void;
}

export const JobContext = createContext<ContextType>({} as ContextType);

// FROM GEM
const sampleJobs: PrintJob[] = [];
// const sampleJobs: PrintJob[] = [{
//   id: '1',
//   name: 'Smartphone Stand',
//   fileName: 'stand-v2.stl',
//   filamentType: 'PLA',
//   filamentColor: 'Black',
//   estimatedTime: 120,
//   progress: 0,
//   status: 'pending',
//   printer: 'Printer 1',
//   createdAt: new Date(),
//   thumbnailUrl: 'https://cdn.thingiverse.com/renders/a7/b5/9f/e6/cf/97e58d8b5a2051113078b94f2fabcabb_preview_featured.jpg',
//   settings: {
//     layerHeight: 0.2,
//     infill: 20,
//     supportEnabled: false,
//     temperature: 210,
//     bedTemperature: 60
//   }
// }, {
//   id: '2',
//   name: 'Desk Organizer',
//   fileName: 'organizer.stl',
//   filamentType: 'PETG',
//   filamentColor: 'Blue',
//   estimatedTime: 240,
//   progress: 65,
//   status: 'printing',
//   printer: 'Printer 2',
//   createdAt: new Date(Date.now() - 3600000),
//   startedAt: new Date(Date.now() - 3600000),
//   thumbnailUrl: 'https://cdn.thingiverse.com/renders/e8/05/d9/96/f8/ce3e3a57725dab3ef2d135f5a8689f4e_preview_featured.jpg',
//   settings: {
//     layerHeight: 0.15,
//     infill: 30,
//     supportEnabled: true,
//     temperature: 230,
//     bedTemperature: 70
//   }
// }, {
//   id: '3',
//   name: 'Miniature Figure',
//   fileName: 'wizard.stl',
//   filamentType: 'PLA',
//   filamentColor: 'Green',
//   estimatedTime: 180,
//   progress: 100,
//   status: 'completed',
//   printer: 'Printer 1',
//   createdAt: new Date(Date.now() - 86400000),
//   startedAt: new Date(Date.now() - 86400000),
//   completedAt: new Date(Date.now() - 75600000),
//   thumbnailUrl: 'https://cdn.thingiverse.com/renders/e4/34/d8/1c/fa/2a7e1493d3cb5707d2e7456c432575b5_preview_featured.jpg',
//   settings: {
//     layerHeight: 0.1,
//     infill: 15,
//     supportEnabled: true,
//     temperature: 205,
//     bedTemperature: 60
//   }
// }];
// const samplePrinters: Printer[] = [{
//   id: '1',
//   name: 'Printer 1',
//   status: 'idle',
//   temperature: {
//     nozzle: 25,
//     bed: 25
//   },
//   model: 'Ender 3 Pro'
// }, {
//   id: '2',
//   name: 'Printer 2',
//   status: 'printing',
//   currentJob: '2',
//   temperature: {
//     nozzle: 230,
//     bed: 70
//   },
//   model: 'Prusa i3 MK3S+'
// }];

export const JobContextProvider: React.FC<Props> = ({children}) => {

  const [printTaskModalOpen, setIsPrintTaskModalOpen] = useState(false);
  const [fileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [printerAddModalOpen, setIsPrinterAddModalOpen] = useState(false);
  const [printerEditModalOpen, setIsPrinterEditModalOpen] = useState(false);
  const [printerIndex, setPrinterIndex] = useState<number|undefined>();
  const [printer, setPrinter] = useState<any|undefined>();
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);

  // FROM GEN
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  // const [printers, setPrinters] = useState<Printer[]>([]);
  const addJob = (job: Omit<PrintJob, 'id' | 'createdAt' | 'progress'>) => {
    const newJob: PrintJob = {
      ...job,
      id: Date.now().toString(),
      createdAt: new Date(),
      progress: 0
    };
    setJobs([...jobs, newJob]);
  };
  const updateJob = (id: string, updates: Partial<PrintJob>) => {
    setJobs(jobs.map(job => job.id === id ? {
      ...job,
      ...updates
    } : job));
  };
  const removeJob = (id: string) => {
    setJobs(jobs.filter(job => job.id !== id));
  };
  const getJob = (id: string) => {
    return jobs.find(job => job.id === id);
  };
  const moveJobUp = (id: string) => {
    const index = jobs.findIndex(job => job.id === id);
    if (index <= 0) return;
    const newJobs = [...jobs];
    const temp = newJobs[index];
    newJobs[index] = newJobs[index - 1];
    newJobs[index - 1] = temp;
    setJobs(newJobs);
  };
  const moveJobDown = (id: string) => {
    const index = jobs.findIndex(job => job.id === id);
    if (index === -1 || index >= jobs.length - 1) return;
    const newJobs = [...jobs];
    const temp = newJobs[index];
    newJobs[index] = newJobs[index + 1];
    newJobs[index + 1] = temp;
    setJobs(newJobs);
  };
  const startJob = (id: string, printerId: string) => {
    // Update job status
    setJobs(jobs.map(job => job.id === id ? {
      ...job,
      status: 'printing',
      startedAt: new Date(),
      printer: printerId
    } : job));
    // Update printer status
    setPrinter(printer.map((printer:any) => printer.id === printerId ? {
      ...printer,
      status: 'printing',
      currentJob: id
    } : printer));
  };
  const pauseJob = (id: string) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    // Update job status
    setJobs(jobs.map(job => job.id === id ? {
      ...job,
      status: 'paused'
    } : job));
  };
  const resumeJob = (id: string) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    // Update job status
    setJobs(jobs.map(job => job.id === id ? {
      ...job,
      status: 'printing'
    } : job));
  };
  const cancelJob = (id: string) => {
    const job = jobs.find(j => j.id === id);
    if (!job || job.status !== 'printing') return;
    // Update job status
    setJobs(jobs.map(job => job.id === id ? {
      ...job,
      status: 'failed'
    } : job));
    // Update printer status
    setPrinter(printer.map((printer:any) => printer.currentJob === id ? {
      ...printer,
      status: 'idle',
      currentJob: undefined
    } : printer));
  };

  return <JobContext.Provider value={{
    jobs,
    // printers,
    addJob,
    updateJob,
    removeJob,
    getJob,
    moveJobUp,
    moveJobDown,
    startJob,
    pauseJob,
    resumeJob,
    cancelJob,

    printTaskModalOpen,
    setIsFileUploadModalOpen,
    fileUploadModalOpen,
    setIsPrintTaskModalOpen,
    printerAddModalOpen, 
    setIsPrinterAddModalOpen,
    printer,
    setPrinter,
    currentFiles,
    setCurrentFiles,
    printerEditModalOpen,
    setIsPrinterEditModalOpen, 
    printerIndex, 
    setPrinterIndex
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
  const [activeTab, setActiveTab] = useState<any>('printers');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null);

  const renderContent = () => {
    switch (activeTab) {
      case 'printers':
        return <Printers 
          onSelectPrinter={setSelectedPrinter}
        />;
      case 'queue':
        return <QueueManagement onSelectJob={setSelectedJob} />;
      case 'job':
        // return selectedJob ? <JobDetails job={selectedJob} /> : <QueueManagement onSelectJob={setSelectedJob} />;
      default:
        return <Printers onSelectPrinter={setSelectedPrinter} />;
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
