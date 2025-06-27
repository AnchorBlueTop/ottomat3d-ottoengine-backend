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
import { useContext, useEffect } from "react";
import { JobContext } from "../App";
import { getAllOttoejectDevices, getOttoejectById } from "../ottoengine_API";
import AddNewOttoejectButton from "./buttons/addNewOttoejectButton";
import newOttoeject from "./modals/newOttoejectModal";
import editOttoeject from "./modals/editOttoeject";
import { OttoejectDevice } from "../representations/ottoejectRepresentation";

export function Ottoeject() {
    const { ottoeject, setOttoeject, setOttoejectIndex, setIsOttoejectEditModalOpen } = useContext(JobContext);

    const ottoEjectFecth = async () => {
        var tempOttoejectList: OttoejectDevice[] = [];

        await getAllOttoejectDevices().then(async (allOttoejects) => {
            allOttoejects.forEach(async (value) => {
                if (value.id && !ottoeject.find((e) => e.id === value.id)?.id) {
                    await getOttoejectById(value.id).then((ottoejectData) => {
                        tempOttoejectList.push(ottoejectData);
                        setOttoeject([...tempOttoejectList]);
                    });
                }
            });
        });
    }

    const OttoejectList = () => {
        if (ottoeject) {
            return (
                <>
                    <Table>
                        <Thead>
                            <Tr>
                                <Th>{'Name'}</Th>
                                <Th>{'Status'}</Th>
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

    useEffect(() => {
        ottoEjectFecth();
    }, []);

    return (
        <>
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