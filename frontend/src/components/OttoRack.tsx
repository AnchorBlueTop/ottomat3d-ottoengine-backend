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
import OttorackModal from "./modals/OttorackModal";
import { OttoRack } from "../representations/ottorackRepresentation";
import { getAllOttoracks, getOttorackById } from "../ottoengine_API";

export function Ottorack() {
    const { ottorack, setOttorack, setOttorackIndex, setIsOttorackEditModalOpen } = useContext(JobContext);

    // Helper to compute capacity metrics
    const getCapacity = (r: OttoRack) => {
        const shelves = r?.shelves ?? [];
        const isEmptyPlate = (s: any) => s?.has_plate === true && s?.plate_state === 'empty';
        const isEmptySlot = (s: any) => s?.has_plate === false;

        const emptyPlates = shelves.filter(isEmptyPlate).length;
        const emptySlots = shelves.filter(isEmptySlot).length;
        return { emptyPlates, emptySlots, totalUsable: emptyPlates + emptySlots };
    };

    const ottoRackFetch = async () => {
        try {
            setLoading(true);
            const allOttoracks = await getAllOttoracks();

            const list = (allOttoracks || []).filter((r: any) => r?.id);
            const details = await Promise.all(
                list.map((r: any) =>
                    getOttorackById(r.id).catch((e) => {
                        console.warn('Failed to fetch rack details for id', r.id, e);
                        return null;
                    })
                )
            );

            const finalList: OttoRack[] = details.filter(Boolean) as OttoRack[];
            // Only set when we have a concrete array (even if empty), avoids stale state
            setOttorack(finalList);
        } catch (error) {
            console.error("Error fetching Ottoracks:", error);
            // On error, don't clear existing UI list; keep current state
        } finally {
            setLoading(false);
        }
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
                                    <Th>{'Empty plates'}</Th>
                                    <Th>{'Empty slots'}</Th>
                                    <Th>{'Capacity (usable)'}</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {ottorack.map((value, index) => {
                                    const { emptyPlates, emptySlots, totalUsable } = getCapacity(value);
                                    return (
                                        <Tr
                                            key={value.id ?? index}
                                            onClick={() => {
                                                setOttorackIndex(index);
                                                setIsOttorackEditModalOpen(true);
                                            }}
                                        >
                                            <Td>{value.name}</Td>
                                            <Td>{value.shelves?.length ?? 0}</Td>
                                            <Td>{emptyPlates}</Td>
                                            <Td>{emptySlots}</Td>
                                            <Td>{totalUsable}</Td>
                                        </Tr>
                                    );
                                })}
                            </Tbody>
                        </Table> : ''
                    }
                </>
            )
        }
    }

    useEffect(() => {
        ottoRackFetch();
    }, []);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                    {AddNewOttorackButton()}
                </PageSection>
                {OttorackList()}
            </div>
            <OttorackModal />
        </>
    );
}