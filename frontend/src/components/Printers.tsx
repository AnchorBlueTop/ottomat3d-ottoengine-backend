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
import PrinterModal from "./modals/PrinterModal";
import AddNewPrinterButton from "./buttons/addNewPrinterButton";
import { getAllPrinters, getPrinterById } from "../ottoengine_API";
import { PrinterRepresentation } from "../representations/printerRepresentation";
import { PRINTER_BRANDS } from "../constants/printerBrands";

export function Printers() {
    const { printer, setPrinter, setIsPrinterEditModalOpen, setPrinterIndex } = useContext(JobContext);

    // Identity helper shared across steps
    const identityKeys = (p: PrinterRepresentation): string[] => {
        const parts: string[] = [];
        if (p.id != null) parts.push(`id:${p.id}`);
        if (p.serial_number) parts.push(`serial:${p.serial_number}`);
        if (p.ip_address) parts.push(`ip:${p.ip_address}`);
        parts.push(`nbm:${p.name ?? ''}|${p.brand ?? ''}|${p.model ?? ''}`);
        return parts;
    };

    const printerFetch = async () => {
        const allPrinters = await getAllPrinters();
        const details: PrinterRepresentation[] = [];
        for (const value of allPrinters) {
            if (value.id) {
                const printerData = await getPrinterById(value.id);
                details.push(printerData);
            }
        }

        // Dedupe fetched details themselves first
        const dedupedFetched: PrinterRepresentation[] = (() => {
            const seen = new Set<string>();
            const out: PrinterRepresentation[] = [];
            for (const p of details) {
                const keys = identityKeys(p);
                const has = keys.some(k => seen.has(k));
                if (!has) {
                    keys.forEach(k => seen.add(k));
                    out.push(p);
                }
            }
            return out;
        })();

        // Merge without duplicates (prefer fetched over existing on overlap)
        setPrinter(prev => {
            const fetchedKeySet = new Set<string>();
            for (const p of dedupedFetched) {
                for (const k of identityKeys(p)) fetchedKeySet.add(k);
            }
            const result: PrinterRepresentation[] = [...dedupedFetched];
            for (const p of prev) {
                const keys = identityKeys(p);
                const overlaps = keys.some(k => fetchedKeySet.has(k));
                if (!overlaps) result.push(p);
            }
            return result;
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
            <PrinterModal />
        </>
    );
}