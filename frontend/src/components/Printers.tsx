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
import { useContext, useEffect } from "react";
import { JobContext } from "../App";
import newPrinter from "./modals/newPrinterModal";
import editPrinter from "./modals/editPrinter";
import AddNewPrinterButton from "./buttons/addNewPrinterButton";
import { getAllPrinters, getPrinterById } from "../ottoengine_API";
import { PrinterRepresentation } from "../representations/printerRepresentation";
import { PRINTER_BRANDS } from "../constants/printerBrands";

export function Printers() {
    const { printer, setPrinter, setIsPrinterEditModalOpen, setPrinterIndex } = useContext(JobContext);
    // const printerFecth = async () => {
    //     var tempPrinterList: PrinterRepresentation[] = [];

    //     // TODO: UPDATE PRINT BED TEMP MORE FREQUENTLY
    //     const allPrinters = await getAllPrinters();
    //     for (const value of allPrinters) {
    //         if (value.id && !printer.find((e) => e.id === value.id)?.id) {
    //             const printerData = await getPrinterById(value.id);
    //             tempPrinterList.push(printerData);
    //             setPrinter([...tempPrinterList]);
    //         }
    //     }
    // }

    const printerFetch = async () => {
        const allPrinters = await getAllPrinters();
        const details: PrinterRepresentation[] = [];
        for (const value of allPrinters) {
            if (value.id) {
                const printerData = await getPrinterById(value.id);
                details.push(printerData);
            }
        }
        setPrinter(prev => {
            const byId = new Map<string, PrinterRepresentation>();
            // Keep existing first (preserve any local edits/order)
            for (const p of prev) {
                const key = String(p.id ?? `${p.name}-${p.brand}-${p.model}`);
                byId.set(key, p);
            }
            // Merge fetched (overwrites same id)
            for (const p of details) {
                const key = String(p.id ?? `${p.name}-${p.brand}-${p.model}`);
                byId.set(key, p);
            }
            return Array.from(byId.values());
        });
    }

    const getBrandLabel = (brandValue?: string) => {
        if (!brandValue) return '';
        return PRINTER_BRANDS.find(b => b.value === brandValue)?.label || brandValue;
    };

    const isConnected = (status?: string) => {
        if (!status) return false;
        const s = String(status).toUpperCase();
        // Treat anything not explicitly OFFLINE/UNKNOWN as connected
        return s !== 'OFFLINE' && s !== 'UNKNOWN';
    };

    const printerList = () => {
        if (printer) {
            return (
                <>
                    <Table>
                        <Thead>
                            <Tr>
                                <Th aria-label="status"/>
                                <Th>{'Name'}</Th>
                                <Th>{'Make and Model'}</Th>
                                <Th>{'Bed Temperature'}</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {printer.map((value, index) => (
                                <Tr
                                    key={value.id ?? index}
                                    onClick={() => {
                                        setPrinterIndex(index)
                                        setIsPrinterEditModalOpen(true)
                                    }}
                                >
                                    <Td width={10}>
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                color: isConnected(value.status)
                                                    ? 'var(--pf-global--success-color--100, var(--pf-v5-global--success-color--100, #3E8635))'
                                                    : 'var(--pf-global--danger-color--100, var(--pf-v5-global--danger-color--100, #C9190B))'
                                            }}
                                            aria-label={isConnected(value.status) ? 'Connected' : 'Not connected'}
                                            title={isConnected(value.status) ? 'Connected' : 'Not connected'}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 8 8" role="img" aria-hidden="true">
                                                <circle cx="4" cy="4" r="4" fill="currentColor" />
                                            </svg>
                                        </span>
                                    </Td>
                                    <Td>{value.name}</Td>
                                    <Td>{getBrandLabel(value.brand)} {value.model}</Td>
                                    <Td>{value.bed_temperature}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </>
            )
        }
    }

    useEffect(() => {
        printerFetch();
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