import {
    Brand,
    Button,
    Content,
    ContentVariants,
    Form,
    FormGroup,
    Grid,
    GridItem,
    Modal,
    ModalFooter,
    ModalHeader,
    PageSection,
    TextInput,
    TextInputGroup,
    TextInputGroupMain
} from "@patternfly/react-core";
import { useContext, useEffect, useState } from "react";
import { JobContext } from "../../App.tsx";
import PrinterIcon from '../../public/printer-Icon.svg'
import thumbnail from '../../public/thumbnail.png';
import { PrinterRepresentation } from "../../representations/printerRepresentation.ts";
import { deletePrinter, getPrinterStatusById, updatePrinterDetails } from "../../ottoengine_API.ts";

export default function editPrinter() {
    const { printer, setPrinter, setIsPrinterEditModalOpen, printerEditModalOpen, printerIndex } = useContext(JobContext);
    const [refresh, setRefresh] = useState(false);
    const [tempPrinter, setTempPrinter] = useState<PrinterRepresentation | undefined>();
    const editPrinterSave = () => {
        setTempPrinter({ ...tempPrinter, status: undefined })
        if (tempPrinter) {
            printer[printerIndex!] = tempPrinter;
        }
        setPrinter(printer);
        if (tempPrinter?.id) {
            const updateResponse = updatePrinterDetails(tempPrinter!.id, tempPrinter).then(() => { console.log('in printer update') });
        }
    }

        async() => {
            if(printerIndex || printerIndex == 0) {
                const printerStatus = getPrinterStatusById(printer[printerIndex!].id!).then(async e => {
            setTempPrinter({...tempPrinter, status: e.status});
            if (e.status === 'ONLINE') {
                // result = taskResult;
            } else if (e.status === 'FAILED') {
                throw new Error(`Task ${printerStatus} failed!`);
            } else {
                // Still processing, wait a bit before polling again
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 30 seconds
            }
        });
            
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const deletingPrinter = (id?: any) => {
        deletePrinter(id);
        delete printer[printerIndex!];
        setPrinter(printer)
    }

    useEffect(() => {
        if (printerIndex || printerIndex == 0) {
            setTempPrinter(printer[printerIndex]);
        }
    }, [printerEditModalOpen, tempPrinter?.status]);

    return (
        <Modal
            isOpen={printerEditModalOpen}
            className="pf-custom-new-printer-modal"
            aria-label="newPrinter"
        >
            <PageSection className="pf-custom-new-printer">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        <Brand src={PrinterIcon} alt="Printer logo" className='pf-custom-modal-icon' />
                        {'EDIT PRINTER'}</Content>
                </ModalHeader>
                <Grid hasGutter>
                    <GridItem span={8}>
                        <Form isHorizontal className="pf-custom-text-align-left">
                            <Grid>
                                <GridItem span={3}>
                                    <Content>{'NAME:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInput
                                        id='printer-name'
                                        value={tempPrinter?.name}
                                        onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, name: value })}
                                        frameBorder={'none'}
                                    />
                                </GridItem>
                            </Grid>

                            <Grid>
                                <GridItem span={3}>
                                    <Content>{'BRAND:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        <TextInputGroupMain id='printer-printer' value={tempPrinter?.brand} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, brand: value })} />
                                    </TextInputGroup>
                                </GridItem>
                            </Grid>

                            <Grid>
                                <GridItem span={3}>
                                    <Content>{'MODEL:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        <TextInputGroupMain id='printer-ottoeject' value={tempPrinter?.model} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, model: value })} />
                                    </TextInputGroup>
                                </GridItem>
                            </Grid>

                            <div className="pf-c-form-group">
                                <span className="pf-custom-border-label">{'CONNECTION: '}</span>
                                <Grid hasGutter>
                                    <Grid>
                                        <GridItem span={3}>
                                            <Content>{'IP ADDRESS:'}</Content>
                                        </GridItem>
                                        <GridItem span={8}>
                                            <TextInputGroup>
                                                <TextInputGroupMain id='printer-connection-ipaddress' value={tempPrinter?.ip_address} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, ip_address: value })} />
                                            </TextInputGroup>
                                        </GridItem>
                                    </Grid>
                                    <Grid>
                                        <GridItem span={3}>
                                            <Content>{'SERIAL:'}</Content>
                                        </GridItem>
                                        <GridItem span={8}>
                                            <TextInputGroup>
                                                <TextInputGroupMain id='printer-connection-serial' value={tempPrinter?.serial_number} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, serial_number: value })} />
                                            </TextInputGroup>
                                        </GridItem>
                                    </Grid>
                                </Grid>
                            </div>
                        </Form>
                    </GridItem>

                    <GridItem span={4}>
                        <FormGroup>
                            <Brand src={thumbnail} alt={"printer thumbnail"} className="pf-custom-thumbnail" />
                            {<Content className="pf-custom-align-center"><strong>{tempPrinter?.status}</strong></Content>}
                        </FormGroup>
                    </GridItem>

                </Grid>

                <ModalFooter className="pf-custom-new-print-job-modal-footer">
                    <Button
                        variant="secondary"
                        onClick={() => { setIsPrinterEditModalOpen(false) }}
                    >
                        {'Cancel'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        onClick={() => {
                            editPrinterSave();
                            setIsPrinterEditModalOpen(false)
                            setTempPrinter({});
                        }}
                    >
                        {'Save'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        variant="danger"
                        onClick={() => {
                            deletingPrinter(printer[printerIndex!].id);
                            setIsPrinterEditModalOpen(false)
                            setTempPrinter({});
                        }}
                    >
                        {'Delete'}
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    )
}