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
import { getAllOttoejectDevices, getOttoejectById } from "../ottoengine_API";
import AddNewOttoejectButton from "./buttons/addNewOttoejectButton";
import newOttoeject from "./newOttoejectModal";
import editOttoeject from "./editOttoeject";
import { OttoejectDevice } from "../representations/ottoejectRepresentation";
// import newPrinter from "./newPrinterModal";
// import editPrinter from "./editPrinter";
// import AddNewPrinterButton from "./buttons/addNewPrinterButton";
// import { getAllPrinters } from "../ottoengine_API";

export function Ottoeject() {
    const { ottoeject, setOttoeject, ottoejectIndex, setOttoejectIndex, setIsOttoejectEditModalOpen } = useContext(JobContext);
    
    const ottoEjectFecth = async () => {
        var tempOttoejectList: OttoejectDevice[] = []; 

        getAllOttoejectDevices().then((allOttoejects) => {
            allOttoejects.map((value, index) => {
                if(value.id && !ottoeject.find((e) => e.id === value.id)?.id) {
                    getOttoejectById( value.id ).then((ottoejectData) => {
                        tempOttoejectList.push(ottoejectData);
                        setOttoeject(tempOttoejectList);
                    })
                }
                
            })
        });
    }

    const OttoejectList = () => {
        if(ottoeject){
            return (
                <>
                
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Name</Th>
                            <Th>Status</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                    {ottoeject.map((value, index) => (
                        <Tr 
                            key={index} 
                            onClick={() => {
                                setOttoejectIndex(index)
                                setIsOttoejectEditModalOpen(true)
                            }}
                        >
                            <Td>{value.device_name}</Td>
                            <Td>{value.status}</Td>
                        </Tr>
                    ))}
                    </Tbody>
                    
                </Table>
                
            </>)
        }
    }

    useEffect(()=>{
        ottoEjectFecth();
    },[]);

    return (
        <>
            <h2 className="text-2xl font-bold mb-6">Ottoeject Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                    {AddNewOttoejectButton()}
                </PageSection>
                {OttoejectList()}
            </div>
            {newOttoeject()}
            {editOttoeject()}
        </>
    );
}