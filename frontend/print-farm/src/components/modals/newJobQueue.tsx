import { Button, Content, ContentVariants, Form, FormSelect, FormSelectOption, Grid, GridItem, Modal, ModalFooter, ModalHeader, PageSection, TextInput } from "@patternfly/react-core";
import { useContext, useEffect, useState } from "react";
import { JobContext } from "../../App";
import { QueueRepresentation } from "../../representations/printJobRepresentation";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import startQueue from '../Queue.tsx';

export default function newJobQueue() {
    const { setQueue, jobQueueModalOpen, setIsJobQueueModalOpen, selectedJobIDs, printer, ottoeject, setPrintJob, printJob } = useContext(JobContext);
    const [tempQueue, setTempQueue] = useState<QueueRepresentation[]>([]);

    useEffect(() => {
        if (selectedJobIDs.length > 0) {
            if (printJob) {
                const initialQueue: QueueRepresentation[] = selectedJobIDs.map(idRef => ({
                    fileName: printJob.find(e => e.id === idRef)?.name,
                    printJobId: idRef,
                    storageLocation: undefined,
                    printer: undefined
                }));
                setTempQueue(initialQueue);
            }
        } else {
            setTempQueue([]);
        }
    }, [selectedJobIDs]);

    const handleStorageLocationChange = (index: number, value: string) => {
        setTempQueue(prevQueue => {
            const newQueue = [...prevQueue];
            newQueue[index] = {
                ...newQueue[index],
                storageLocation: Number(value)
            };
            return newQueue;
        });
    };

    const handlePrinterChange = (index: number, printerModel: string) => {
        setTempQueue(prevQueue => {
            const newQueue = [...prevQueue];
            const selectedPrinter = printer.find(p => p.model === printerModel);
            newQueue[index] = {
                ...newQueue[index],
                printer: selectedPrinter
            };
            return newQueue;
        });
    };

    const createQueue = () => {
        setQueue(tempQueue);
        startQueue(tempQueue, ottoeject, setPrintJob);
        setIsJobQueueModalOpen(false);
    }

    return (
        <Modal
            isOpen={jobQueueModalOpen}
            className="pf-custom-new-print-queue-modal"
            aria-label="newPrintQueue"
            onClose={() => setIsJobQueueModalOpen(false)}
        >
            <PageSection className="pf-custom-new-print-queue">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        {' NEW PRINT QUEUE'}
                    </Content>
                </ModalHeader>
                <Grid hasGutter>
                    <GridItem span={12}>
                        <Form isHorizontal className="pf-custom-text-align-left">
                            {selectedJobIDs.length > 0 ?
                                <Table aria-label="Print Job Queue Table">
                                    <Thead>
                                        <Tr>
                                            <Th>{'Filename'}</Th>
                                            <Th>{'Storage Location'}</Th>
                                            <Th>{'Printer'}</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {tempQueue.map((job, index) => (
                                            <Tr key={index}>
                                                <Td data-label="Filename">{job.fileName}</Td>
                                                <Td data-label="Storage Location" width={30}>
                                                    <TextInput
                                                        id={`storage-location-${index}`}
                                                        value={job.storageLocation || ''}
                                                        onChange={(_event, value) => handleStorageLocationChange(index, value)}
                                                    />
                                                </Td>
                                                <Td data-label="Printer" width={50}>
                                                    <FormSelect
                                                        value={job.printer?.model || ''}
                                                        onChange={(_event, value) => handlePrinterChange(index, value)}
                                                        aria-label={`Select printer for ${job.fileName}`}
                                                    >
                                                        <FormSelectOption key="default" value="" label="Select a printer" isDisabled />
                                                        {printer.map((printerItem, printerIndex) => (
                                                            <FormSelectOption
                                                                key={printerIndex}
                                                                value={printerItem.model}
                                                                label={printerItem.model as string}
                                                            />
                                                        ))}
                                                    </FormSelect>
                                                </Td>
                                            </Tr>
                                        ))}
                                    </Tbody>
                                </Table> : <p>No print jobs selected.</p>
                            }
                        </Form>
                    </GridItem>
                </Grid>

                <ModalFooter className="pf-custom-new-print-job-modal-footer">
                    <Button
                        variant="danger"
                        onClick={() => { setIsJobQueueModalOpen(false) }}
                    >
                        {'Cancel'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        onClick={createQueue}
                    >
                        {'START'}
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    );
}