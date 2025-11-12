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
import { useContext, useEffect, useRef } from "react";
import { JobContext } from "../App";
import { getAllOttoejectDevices, getOttoejectById } from "../ottoengine_API";
import AddNewOttoejectButton from "./buttons/addNewOttoejectButton";
import OttoejectModal from "./modals/OttoejectModal";

export function Ottoeject() {
    const { ottoeject, setOttoeject, setOttoejectIndex, setIsOttoejectEditModalOpen } = useContext(JobContext);
    const fetchedRef = useRef(false);
    
    const ottoEjectFetch = async () => {
        // Prevent multiple fetches (StrictMode/double render)
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        try {
            const all = await getAllOttoejectDevices();

            const ids = Array.from(
                new Set(
                    (all ?? [])
                        .map(d => d.id)
                        .filter((id): id is number => id !== undefined && id !== null)
                )
            );

            if (ids.length === 0) {
                setOttoeject([]);
                return;
            }

            // Batch detail calls and set state once
            const details = await Promise.all(ids.map(id => getOttoejectById(id)));
            setOttoeject(details);
        } catch (e) {
            console.error('Failed to load ottoeject devices:', e);
            setOttoeject([]); // optional
        }
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
        ottoEjectFetch();
    }, []);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                    {AddNewOttoejectButton()}
                </PageSection>
                {OttoejectList()}
            </div>
            <OttoejectModal />
        </>
    );
}