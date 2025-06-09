// import React, { useState, createContext, useContext, ReactNode } from 'react';
// export type JobStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'paused';
// export interface PrintJob {
//   id: string;
//   name: string;
//   fileName: string;
//   filamentType: string;
//   filamentColor: string;
//   estimatedTime: number; // in minutes
//   progress: number; // 0-100
//   status: JobStatus;
//   printer: string;
//   createdAt: Date;
//   startedAt?: Date;
//   completedAt?: Date;
//   thumbnailUrl?: string;
//   settings: {
//     layerHeight: number;
//     infill: number;
//     supportEnabled: boolean;
//     temperature: number;
//     bedTemperature: number;
//   };
// }
// interface Printer {
//   id: string;
//   name: string;
//   status: 'idle' | 'printing' | 'offline' | 'error';
//   currentJob?: string;
//   temperature: {
//     nozzle: number;
//     bed: number;
//   };
//   model: string;
// }
// interface QueueContextType {
//   jobs: PrintJob[];
//   printers: Printer[];
//   addJob: (job: Omit<PrintJob, 'id' | 'createdAt' | 'progress'>) => void;
//   updateJob: (id: string, updates: Partial<PrintJob>) => void;
//   removeJob: (id: string) => void;
//   getJob: (id: string) => PrintJob | undefined;
//   moveJobUp: (id: string) => void;
//   moveJobDown: (id: string) => void;
//   startJob: (id: string, printerId: string) => void;
//   pauseJob: (id: string) => void;
//   resumeJob: (id: string) => void;
//   cancelJob: (id: string) => void;
// }
// const QueueContext = createContext<QueueContextType | undefined>(undefined);
// // Sample data
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
// // const samplePrinters: Printer[] = [{
// //   id: '1',
// //   name: 'Printer 1',
// //   status: 'idle',
// //   temperature: {
// //     nozzle: 25,
// //     bed: 25
// //   },
// //   model: 'Ender 3 Pro'
// // }, {
// //   id: '2',
// //   name: 'Printer 2',
// //   status: 'printing',
// //   currentJob: '2',
// //   temperature: {
// //     nozzle: 230,
// //     bed: 70
// //   },
// //   model: 'Prusa i3 MK3S+'
// // }];
// interface QueueProviderProps {
//   children: ReactNode;
// }
// export const QueueProvider: React.FC<QueueProviderProps> = ({
//   children
// }) => {
//   const [jobs, setJobs] = useState<PrintJob[]>(sampleJobs);
//   const [printers, setPrinters] = useState<Printer[]>([]);
//   const addJob = (job: Omit<PrintJob, 'id' | 'createdAt' | 'progress'>) => {
//     const newJob: PrintJob = {
//       ...job,
//       id: Date.now().toString(),
//       createdAt: new Date(),
//       progress: 0
//     };
//     setJobs([...jobs, newJob]);
//   };
//   const updateJob = (id: string, updates: Partial<PrintJob>) => {
//     setJobs(jobs.map(job => job.id === id ? {
//       ...job,
//       ...updates
//     } : job));
//   };
//   const removeJob = (id: string) => {
//     setJobs(jobs.filter(job => job.id !== id));
//   };
//   const getJob = (id: string) => {
//     return jobs.find(job => job.id === id);
//   };
//   const moveJobUp = (id: string) => {
//     const index = jobs.findIndex(job => job.id === id);
//     if (index <= 0) return;
//     const newJobs = [...jobs];
//     const temp = newJobs[index];
//     newJobs[index] = newJobs[index - 1];
//     newJobs[index - 1] = temp;
//     setJobs(newJobs);
//   };
//   const moveJobDown = (id: string) => {
//     const index = jobs.findIndex(job => job.id === id);
//     if (index === -1 || index >= jobs.length - 1) return;
//     const newJobs = [...jobs];
//     const temp = newJobs[index];
//     newJobs[index] = newJobs[index + 1];
//     newJobs[index + 1] = temp;
//     setJobs(newJobs);
//   };
//   const startJob = (id: string, printerId: string) => {
//     // Update job status
//     setJobs(jobs.map(job => job.id === id ? {
//       ...job,
//       status: 'printing',
//       startedAt: new Date(),
//       printer: printerId
//     } : job));
//     // Update printer status
//     setPrinters(printers.map(printer => printer.id === printerId ? {
//       ...printer,
//       status: 'printing',
//       currentJob: id
//     } : printer));
//   };
//   const pauseJob = (id: string) => {
//     const job = jobs.find(j => j.id === id);
//     if (!job) return;
//     // Update job status
//     setJobs(jobs.map(job => job.id === id ? {
//       ...job,
//       status: 'paused'
//     } : job));
//   };
//   const resumeJob = (id: string) => {
//     const job = jobs.find(j => j.id === id);
//     if (!job) return;
//     // Update job status
//     setJobs(jobs.map(job => job.id === id ? {
//       ...job,
//       status: 'printing'
//     } : job));
//   };
//   const cancelJob = (id: string) => {
//     const job = jobs.find(j => j.id === id);
//     if (!job || job.status !== 'printing') return;
//     // Update job status
//     setJobs(jobs.map(job => job.id === id ? {
//       ...job,
//       status: 'failed'
//     } : job));
//     // Update printer status
//     setPrinters(printers.map(printer => printer.currentJob === id ? {
//       ...printer,
//       status: 'idle',
//       currentJob: undefined
//     } : printer));
//   };
//   return <QueueContext.Provider value={{
//     jobs,
//     printers,
//     addJob,
//     updateJob,
//     removeJob,
//     getJob,
//     moveJobUp,
//     moveJobDown,
//     startJob,
//     pauseJob,
//     resumeJob,
//     cancelJob
//   }}>
//       {children}
//     </QueueContext.Provider>;
// };
// export const useQueue = () => {
//   const context = useContext(QueueContext);
//   if (context === undefined) {
//     throw new Error('useQueue must be used within a QueueProvider');
//   }
//   return context;
// };