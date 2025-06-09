// import React from 'react';
// import { Job } from './Jobs';
// import { useQueue } from '../App.tsx';
// // import { ArrowUpIcon, ArrowDownIcon, PlayIcon, PauseIcon, XCircleIcon } from 'lucide-react';
// interface QueueProps {
//   onSelectJob?: (id: string) => void;
// }
// export const QueueManagement: React.FC<QueueProps> = ({
//   onSelectJob
// }) => {
//   const {
//     jobs,
//     moveJobUp,
//     moveJobDown,
//     startJob,
//     pauseJob,
//     resumeJob,
//     cancelJob,
//     printer
//   } = useQueue();
//   const pendingJobs = jobs.filter(job => job.status === 'pending');
//   const activeJobs = jobs.filter(job => ['printing', 'paused'].includes(job.status));
//   // const completedJobs = jobs.filter(job => ['completed', 'failed'].includes(job.status));
//   // const availablePrinters = printer.filter(printer => printer.status === 'idle');
  
//   return 
//   <div className="flex flex-col h-full">
//       <div className="mb-6">
//         <h2 className="text-lg font-semibold mb-4">Active Jobs</h2>
//         {activeJobs.length === 0 ? <div className="bg-white rounded-lg p-4 shadow-sm text-gray-500">
//             No active jobs
//           </div> : <div className="space-y-3">
//             {activeJobs.map(job => <Job key={job.id} job={job} onClick={() => onSelectJob && onSelectJob(job.id)} actions={<div className="flex space-x-2">
//                     {job.status === 'printing' ? <button onClick={e => {
//             e.stopPropagation();
//             pauseJob(job.id);
//           }} className="p-2 bg-amber-100 text-amber-700 rounded hover:bg-amber-200" title="Pause">
//                         {/* <PauseIcon size={16} /> */}
//                       </button> : <button onClick={e => {
//             e.stopPropagation();
//             resumeJob(job.id);
//           }} className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Resume">
//                         {/* <PlayIcon size={16} /> */}
//                       </button>}
//                     <button onClick={e => {
//             e.stopPropagation();
//             cancelJob(job.id);
//           }} className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Cancel">
//                       {/* <XCircleIcon size={16} /> */}
//                     </button>
//                   </div>} />)}
//           </div>}
//       </div>
//       <div className="mb-6">
//         <h2 className="text-lg font-semibold mb-4">Pending Queue</h2>
//         {pendingJobs.length === 0 ? <div className="bg-white rounded-lg p-4 shadow-sm text-gray-500">
//             No pending jobs
//           </div> : <div className="space-y-3">
//             {pendingJobs.map((job, index) => <Job key={job.id} job={job} onClick={() => onSelectJob && onSelectJob(job.id)} actions={<div className="flex space-x-2">
//                     {availablePrinters.length > 0 && <div className="relative group">
//                         <button className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Start printing">
//                           {/* <PlayIcon size={16} /> */}
//                         </button>
//                         <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 hidden group-hover:block">
//                           <div className="py-1">
//                             <p className="px-4 py-2 text-sm text-gray-700 font-medium border-b">
//                               Select printer:
//                             </p>
//                             {availablePrinters.map((printer:any) => <button key={printer.id} onClick={e => {
//                   e.stopPropagation();
//                   startJob(job.id, printer.id);
//                 }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
//                                 {printer.name} ({printer.model})
//                               </button>)}
//                           </div>
//                         </div>
//                       </div>}
//                     <button onClick={e => {
//             e.stopPropagation();
//             moveJobUp(job.id);
//           }} disabled={index === 0} className={`p-2 ${index === 0 ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'} rounded`} title="Move up">
//                       {/* <ArrowUpIcon size={16} /> */}
//                     </button>
//                     <button onClick={e => {
//             e.stopPropagation();
//             moveJobDown(job.id);
//           }} disabled={index === pendingJobs.length - 1} className={`p-2 ${index === pendingJobs.length - 1 ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'} rounded`} title="Move down">
//                       {/* <ArrowDownIcon size={16} /> */}
//                     </button>
//                   </div>} />)}
//           </div>}
//       </div>
//       <div>
//         <h2 className="text-lg font-semibold mb-4">Completed Jobs</h2>
//         {completedJobs.length === 0 ? <div className="bg-white rounded-lg p-4 shadow-sm text-gray-500">
//             No completed jobs
//           </div> : <div className="space-y-3">
//             {completedJobs.map(job => <Job key={job.id} job={job} onClick={() => onSelectJob && onSelectJob(job.id)} />)}
//           </div>}
//       </div>
//     </div>;
// };