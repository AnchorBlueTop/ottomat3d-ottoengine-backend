import {
  // Button,
  Page,
  // PageSection
} from "@patternfly/react-core";
import './App.css';
import React, { createContext, useState } from "react";
// import { moonraker } from "./listAPI";
import { PageHeader } from "./Page-Header";
// import addPrintTask from "./AddPrintTask";
import Dashboard from "./Dashboard";
import loadAPI from "./loadAPI";
import APILoader from "./loadAPI";
import printerRepresentation from "./printerRepresentation";
import readFile from "./readFileRepresentation";

interface Props {
  children: React.ReactNode;
}
type ContextType = {
  printer: printerRepresentation;
  setPrinter: React.Dispatch<React.SetStateAction<printerRepresentation>>;
  printTaskModalOpen: boolean;
  setIsPrintTaskModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileUploadModalOpen: boolean;
  setIsFileUploadModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentFiles: File[];
  setCurrentFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

export const JobContext = createContext<ContextType>({} as ContextType);

export const JobContextProvider: React.FC<Props> = ({children}) => {
  const [printer, setPrinter] = useState<any|undefined>();
  const [printTaskModalOpen, setIsPrintTaskModalOpen] = useState(false);
  const [fileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);



  return <JobContext.Provider value = {
    {
      printer, setPrinter, 
      printTaskModalOpen, setIsPrintTaskModalOpen,
      fileUploadModalOpen, setIsFileUploadModalOpen,
      currentFiles, setCurrentFiles
    }}>{children}</JobContext.Provider>
}

export default function App() {
  return (
    <JobContextProvider>
        <div className="App">
          <Page masthead={<PageHeader/>}>
            <Dashboard/>
          </Page>
        </div>
    </JobContextProvider>

  )
}
