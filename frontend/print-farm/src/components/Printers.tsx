import { 
    PageSection, 
    Button, 
    Content,
} from "@patternfly/react-core";
import {
    Table,
    Thead,
    Tbody,
    Th,
    Tr,
    Td
} from "@patternfly/react-table";
import { useContext, useEffect, useState } from "react";
import { JobContext } from "../App";
import newPrinter from "./newPrinterModal";
import editPrinter from "./editPrinter";

interface Printer {
    id: number;
    name: string;
    model: string;
    status: 'online' | 'offline' | 'maintenance';
    currentJob?: {
        name: string;
        progress: number;
        timeRemaining: string;
    };
}
interface PrinterListProps {
    onSelectPrinter: (printer: any) => void;
}
export function Printers({
    onSelectPrinter
}: PrinterListProps) {
    const { printer, setPrinter, setIsPrinterAddModalOpen, setIsPrinterEditModalOpen, printerIndex, setPrinterIndex } = useContext(JobContext);
    // const [index, setIndex] = useState<number>();
    // Mock data - in a real app this would come from an API
    // const [printers] = useState<Printer[]>([{
    //     id: 1,
    //     name: 'Printer Alpha',
    //     model: 'Prusa i3 MK3S+',
    //     status: 'online',
    //     currentJob: {
    //         name: 'Mechanical Part A42',
    //         progress: 65,
    //         timeRemaining: '1h 23m'
    //     }
    // }, {
    //     id: 2,
    //     name: 'Printer Beta',
    //     model: 'Creality Ender 3 Pro',
    //     status: 'online',
    //     currentJob: {
    //         name: 'Phone Stand',
    //         progress: 12,
    //         timeRemaining: '3h 45m'
    //     }
    // }, {
    //     id: 3,
    //     name: 'Printer Gamma',
    //     model: 'Ultimaker S5',
    //     status: 'maintenance'
    // }, {
    //     id: 4,
    //     name: 'Printer Delta',
    //     model: 'Formlabs Form 3',
    //     status: 'offline'
    // }]);
    // const getStatusIcon = (status: string) => {
    //     switch (status) {
    //         case 'online':
    //             // return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    //         case 'offline':
    //             // return <AlertCircleIcon className="h-5 w-5 text-red-500" />;
    //         case 'maintenance':
    //             // return <PauseCircleIcon className="h-5 w-5 text-yellow-500" />;
    //         default:
    //             return null;
    //     }
    // };
    // console.log('printerindex = '+ printerIndex)
    const printerList = () => {
        if(printer){
            // console.log('printers List')
            // console.log(printer);
            // return printer.map(a => a.name);
            
            return (
                <>
                
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Name</Th>
                            <Th>Printer</Th>
                            <Th>OTTOeject</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                    {printer.map((value, index) => (
                        <Tr 
                            key={index} 
                            onClick={() => {
                                setPrinterIndex(index)
                                setIsPrinterEditModalOpen(true)
                            }}
                        >
                            <Td>{value.name}</Td>
                            <Td>{value.printer}</Td>
                            <Td>{value.ottoeject}</Td>
                        </Tr>
                    ))}
                    </Tbody>
                    
                </Table>
                
            </>)
            // return (
            //     <>
            //         <Content>{printer[0].name}</Content>
            //         <Content>{printer[0].printer}</Content>
            //         <Content>{printer[0].connection?.ipAddress}</Content>
            //     </>

            // );


        }
    }

    useEffect(()=>{

    },[]);

    return (
        <>
        {/* // <div className="w-full"> */}
            <h2 className="text-2xl font-bold mb-6">Printer Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* {printers.map((printer:any) => <div key={printer.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelectPrinter(printer)}> */}
                    {/* <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold">{printer.name}</h3>
                        <div className="flex items-center">
                            {getStatusIcon(printer.status)}
                            <span className="ml-2 text-sm capitalize">
                                {printer.status}
                            </span>
                        </div>
                    </div>
                    <p className="text-gray-600 mb-4">Model: {printer.model}</p>
                    {printer.currentJob ? <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{printer.currentJob.name}</span>
                            <span>{printer.currentJob.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{
                                width: `${printer.currentJob.progress}%`
                            }}></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Time remaining: {printer.currentJob.timeRemaining}
                        </p>
                    </div> : <p className="text-sm text-gray-500 italic">No active job</p>}
                    <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
                        <button className="text-sm text-blue-600 hover:text-blue-800">
                            Manage Printer
                        </button>
                    </div> */}
                {/* </div>)} */}

                <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                    <Button 
                        id="add-printer-button" 
                        className="pf-custom-add-print-button"
                        onClick={() => setIsPrinterAddModalOpen(true)}
                    >
                        {'+ Add'}
                    </Button>
                </PageSection>
                {printerList()}
            </div>
            {newPrinter()}
            {editPrinter()}
            
            
        {/* // </div> */}
        </>
    );
}