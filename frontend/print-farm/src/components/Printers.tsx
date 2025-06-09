import {
    PageSection
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
import newPrinter from "./modals/newPrinterModal";
import editPrinter from "./modals/editPrinter";
import AddNewPrinterButton from "./buttons/addNewPrinterButton";
import { getAllPrinters, getPrinterById } from "../ottoengine_API";
import { PrinterRepresentation } from "../representations/printerRepresentation";

export function Printers() {
    const { printer, setPrinter, setIsPrinterAddModalOpen, setIsPrinterEditModalOpen, printerIndex, setPrinterIndex } = useContext(JobContext);
    const printerFecth = async () => {
        var tempPrinterList: PrinterRepresentation[] = [];


        // TODO: UPDATE PRINT BED TEMP MORE FREQUENTLY
        getAllPrinters().then((allPrinters) => {
            allPrinters.map((value, index) => {
                if (value.id && !printer.find((e) => e.id === value.id)?.id) {
                    getPrinterById(value.id).then((printerData) => {
                        tempPrinterList.push(printerData);
                        setPrinter(tempPrinterList);
                    })
                }

            })
        });

    }

    const printerList = () => {
        if (printer) {
            return (
                <>

                    <Table>
                        <Thead>
                            <Tr>
                                <Th>{'Name'}</Th>
                                <Th>{'Brand'}</Th>
                                <Th>{'Model'}</Th>
                                <Th>{'Bed Temperature'}</Th>
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
                                    <Td>{value.brand}</Td>
                                    <Td>{value.model}</Td>
                                    <Td>{value.bed_temperature}</Td>
                                </Tr>
                            ))}
                        </Tbody>

                    </Table>

                </>)
        }
    }

    useEffect(() => {
        printerFecth();

    }, []);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                    {AddNewPrinterButton()}
                </PageSection>
                {printerList()}
            </div>
            {newPrinter()}
            {editPrinter()}
        </>
    );
}