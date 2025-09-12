import {
    PageSection,
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
import AddNewOttorackButton from "./buttons/addNewOttorackButton";
import newOttorack from "./modals/newOttorackModal";
import { OttoRack } from "../representations/ottorackRepresentation";
import editOttorack from "./modals/editOttorack";

export function Ottorack() {
    const { ottorack, setOttorack, ottorackIndex, setOttorackIndex, setIsOttorackEditModalOpen } = useContext(JobContext);

    const ottoRackFecth = async () => {
        var tempOttorackList: OttoRack[] = [];

        //  TODO: IMPLEMENT ONCE API EXITS
        // getAllOttoracks().then((allOttoracks) => {
        //     allOttoracks.map((value, index) => {
        //         if (value.id && !ottorack.find((e) => e.id === value.id)?.id) {
        //             getOttorackById(value.id).then((ottorackData) => {
        //                 tempOttorackList.push(ottorackData);
        //                 setOttorack(tempOttorackList);
        //             })
        //         }

        //     })
        // });
    }

    const OttorackList = () => {
        if (ottorack) {
            return (
                <>
                    {ottorack.length ?
                        <Table>
                            <Thead>
                                <Tr>
                                    <Th>{'Name'}</Th>
                                    <Th>{'Number of Shelves'}</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {ottorack.map((value, index) => (
                                    <Tr
                                        key={index}
                                        onClick={() => {
                                            setOttorackIndex(index);
                                            setIsOttorackEditModalOpen(true);
                                        }}
                                    >
                                        <Td>{value.name}</Td>
                                        <Td>{value.shelves?.length}</Td>
                                    </Tr>
                                ))}
                            </Tbody>

                        </Table> : ''
                    }
                </>)
        }
    }

    useEffect(() => {
        ottoRackFecth();
    }, []);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                    {AddNewOttorackButton()}
                </PageSection>
                {OttorackList()}
            </div>
            {newOttorack()}
            {editOttorack()}
        </>
    );
}