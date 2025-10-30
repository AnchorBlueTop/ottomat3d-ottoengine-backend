import {
  AlertProps,
  PageSection,
  Spinner
} from "@patternfly/react-core";
import React, { createContext, ReactNode, useContext, useState, Suspense, lazy } from "react";
import { PrinterRepresentation } from "./representations/printerRepresentation";
import { Layout } from "./Layout";
import './App.css';
import { OttoejectDevice } from "./representations/ottoejectRepresentation";
import PrintJobRepresentation, { QueueRepresentation } from "./representations/printJobRepresentation";
import { OttoRack } from "./representations/ottorackRepresentation";
import { Routes, Route, Navigate } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

// Lazy-load screens for code-splitting
const Dashboard = lazy(() => import('./components/Dashboard'));
const Jobs = lazy(() => import('./components/Jobs').then(m => ({ default: m.Job })));
const Printers = lazy(() => import('./components/Printers').then(m => ({ default: m.Printers })));
const Ottoeject = lazy(() => import('./components/OttoEject').then(m => ({ default: m.Ottoeject })));
const Ottorack = lazy(() => import('./components/OttoRack').then(m => ({ default: m.Ottorack })));

type ContextType = {
  // Printer context
  printer: PrinterRepresentation[];
  setPrinter: React.Dispatch<React.SetStateAction<PrinterRepresentation[]>>;
  printerAddModalOpen: boolean;
  setIsPrinterAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  printerEditModalOpen: boolean;
  setIsPrinterEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  printerIndex: number | undefined;
  setPrinterIndex: React.Dispatch<React.SetStateAction<number | undefined>>;

  // Otto - Eject context
  ottoeject: OttoejectDevice[];
  setOttoeject: React.Dispatch<React.SetStateAction<OttoejectDevice[]>>;
  ottoejectAddModalOpen: boolean;
  setIsOttoejectAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ottoejectEditModalOpen: boolean;
  setIsOttoejectEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ottoejectIndex: number | undefined;
  setOttoejectIndex: React.Dispatch<React.SetStateAction<number | undefined>>;

  // Otto - Rack context
  ottorack: OttoRack[];
  setOttorack: React.Dispatch<React.SetStateAction<OttoRack[]>>;
  ottorackAddModalOpen: boolean;
  setIsOttorackAddModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ottorackEditModalOpen: boolean;
  setIsOttorackEditModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  ottorackIndex: number | undefined;
  setOttorackIndex: React.Dispatch<React.SetStateAction<number | undefined>>;

  // Print Job context
  printTaskModalOpen: boolean;
  setIsPrintTaskModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileUploadModalOpen: boolean;
  setIsFileUploadModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentFiles: File[];
  setCurrentFiles: React.Dispatch<React.SetStateAction<any[]>>;
  printFile: any | undefined;
  setPrintFile: React.Dispatch<React.SetStateAction<any | undefined>>;
  printJob: PrintJobRepresentation[];
  setPrintJob: React.Dispatch<React.SetStateAction<PrintJobRepresentation[]>>;
  printJobIndex: number | undefined;
  setPrintJobIndex: React.Dispatch<React.SetStateAction<number | undefined>>;
  selectedJobIDs: any[];
  setSelectedJobIDs: React.Dispatch<React.SetStateAction<any[]>>;
  printJobUID: number | undefined;
  setPrintJobUID: React.Dispatch<React.SetStateAction<number | undefined>>;
  isEditPrintJobModalOpen: boolean;
  setIsEditPrintJobModalOpen: (open: boolean) => void;

  // Print Queue
  jobQueueModalOpen: boolean;
  setIsJobQueueModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  queue: QueueRepresentation[];
  setQueue: React.Dispatch<React.SetStateAction<QueueRepresentation[]>>;
  queueIndex: number | undefined;
  setQueueIndex: React.Dispatch<React.SetStateAction<number | undefined>>;

  //common context
  alerts: Partial<AlertProps>[];
  setAlerts: React.Dispatch<React.SetStateAction<Partial<AlertProps>[]>>;

}

export const JobContext = createContext<ContextType>({} as ContextType);

export const JobContextProvider: React.FC<Props> = ({ children }) => {
  // Printer
  const [printerAddModalOpen, setIsPrinterAddModalOpen] = useState(false);
  const [printerEditModalOpen, setIsPrinterEditModalOpen] = useState(false);
  const [printerIndex, setPrinterIndex] = useState<number | undefined>();
  const [printer, setPrinter] = useState<any | undefined>([]);

  // Otto Eject
  const [ottoejectAddModalOpen, setIsOttoejectAddModalOpen] = useState(false);
  const [ottoejectEditModalOpen, setIsOttoejectEditModalOpen] = useState(false);
  const [ottoejectIndex, setOttoejectIndex] = useState<number | undefined>();
  const [ottoeject, setOttoeject] = useState<OttoejectDevice[]>([]);

  // Otto Rack
  const [ottorackAddModalOpen, setIsOttorackAddModalOpen] = useState(false);
  const [ottorackEditModalOpen, setIsOttorackEditModalOpen] = useState(false);
  const [ottorackIndex, setOttorackIndex] = useState<number | undefined>();
  const [ottorack, setOttorack] = useState<OttoRack[]>([]);

  // Print Job
  const [printTaskModalOpen, setIsPrintTaskModalOpen] = useState(false);
  const [fileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [currentFiles, setCurrentFiles] = useState<any[]>([]);
  const [printJob, setPrintJob] = useState<PrintJobRepresentation[]>([]);
  const [printJobIndex, setPrintJobIndex] = useState<number | undefined>();
  const [printFile, setPrintFile] = useState<any | undefined>();
  const [selectedJobIDs, setSelectedJobIDs] = useState<string[]>([]);
  const [jobQueueModalOpen, setIsJobQueueModalOpen] = useState(false);
  const [printJobUID, setPrintJobUID] = useState<number | undefined>();
  const [isEditPrintJobModalOpen, setIsEditPrintJobModalOpen] = useState(false);
  

  // Print Queue
  const [queue, setQueue] = useState<QueueRepresentation[]>([]);
  const [queueIndex, setQueueIndex] = useState<number | undefined>();

  // Common
  const [alerts, setAlerts] = useState<Partial<AlertProps>[]>([]);

  return <JobContext.Provider value={{
    // Priner context
    printer,
    setPrinter,
    printerAddModalOpen,
    setIsPrinterAddModalOpen,
    printerEditModalOpen,
    setIsPrinterEditModalOpen,
    printerIndex,
    setPrinterIndex,

    // Otto - Eject context
    ottoejectAddModalOpen,
    setIsOttoejectAddModalOpen,
    ottoejectEditModalOpen,
    setIsOttoejectEditModalOpen,
    ottoeject,
    setOttoeject,
    ottoejectIndex,
    setOttoejectIndex,

    // Otto - Rack context
    ottorackAddModalOpen,
    setIsOttorackAddModalOpen,
    ottorackEditModalOpen,
    setIsOttorackEditModalOpen,
    ottorack,
    setOttorack,
    ottorackIndex,
    setOttorackIndex,

    // Print Job context
    printTaskModalOpen,
    setIsFileUploadModalOpen,
    fileUploadModalOpen,
    setIsPrintTaskModalOpen,
    currentFiles,
    setCurrentFiles,
    printJob,
    setPrintJob,
    printJobIndex,
    setPrintJobIndex,
    printFile,
    setPrintFile,
    selectedJobIDs,
    setSelectedJobIDs,
    printJobUID,
    setPrintJobUID,
    isEditPrintJobModalOpen,
    setIsEditPrintJobModalOpen,

    // Print Queue
    queue,
    setQueue,
    jobQueueModalOpen,
    setIsJobQueueModalOpen,
    queueIndex,
    setQueueIndex,

    //common context
    alerts,
    setAlerts,

  }}>
    {children}
  </JobContext.Provider>;
}

export const useQueue = () => {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};

export default function App() {
  return (
    <JobContextProvider>
      <Suspense fallback={<PageSection className="App"><Spinner /></PageSection>}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/printers" element={<Printers />} />
            <Route path="/eject" element={<Ottoeject />} />
            <Route path="/rack" element={<Ottorack />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </JobContextProvider>
  );
}
