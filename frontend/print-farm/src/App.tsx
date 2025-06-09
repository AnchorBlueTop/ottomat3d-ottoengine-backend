import {
  AlertProps,
  PageSection,
  Spinner
} from "@patternfly/react-core";
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { PrinterRepresentation } from "./representations/printerRepresentation";
import { Layout } from "./Layout";
import './App.css';
import { OttoejectDevice } from "./representations/ottoejectRepresentation";
import PrintJobRepresentation, { QueueRepresentation } from "./representations/printJobRepresentation";
import { OttoRack } from "./representations/ottorackRepresentation";

interface Props {
  children: ReactNode;
}

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
  currentFiles: any[];
  setCurrentFiles: React.Dispatch<React.SetStateAction<any[]>>;
  printFile: any | undefined;
  setPrintFile: React.Dispatch<React.SetStateAction<any | undefined>>;
  printJob: PrintJobRepresentation[];
  setPrintJob: React.Dispatch<React.SetStateAction<PrintJobRepresentation[]>>;
  printJobIndex: number | undefined;
  setPrintJobIndex: React.Dispatch<React.SetStateAction<number | undefined>>;
  selectedJobIDs: any[];
  setSelectedJobIDs: React.Dispatch<React.SetStateAction<any[]>>;

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
  const [activeTab, setActiveTab] = useState<any>('dashboard');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [])

  return (
    <JobContextProvider>
      <PageSection className="App">
        <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
          {loading ? <Spinner /> : ''}
        </Layout>
      </PageSection>
    </JobContextProvider>
  );
}
