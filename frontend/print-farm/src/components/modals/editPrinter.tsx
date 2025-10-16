import {
    Brand,
    Button,
    Content,
    ContentVariants,
    Form,
    FormGroup,
    FormSelect,
    FormSelectOption,
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
import { deletePrinter, getPrinterStatusById, sendGCodeToPrinter, updatePrinterDetails } from "../../ottoengine_API.ts";
import { PRINTER_BRANDS } from "../../constants/printerBrands";
import { PRINTER_MODELS } from "../../constants/printerModels";

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

    const levelBed = async (id?: any) => {
        console.log('Leveling Pinter Bed on printer ID: ', id);
        await sendGCodeToPrinter(id, { gcode: "G90\nG1 Z150 F3000" });
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
                                    <Content>{'PRINTER BRAND:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <FormSelect
                                        id="printer-brand"
                                        value={tempPrinter?.brand ?? ''}
                                        onChange={(_event, value: string) => {
                                            // when brand changes, clear model to force re-select
                                            setTempPrinter({ ...tempPrinter, brand: value, model: '' as any });
                                        }}
                                        aria-label="Select printer brand"
                                    >
                                        <FormSelectOption key="placeholder" label="Select a brand" value="" />
                                        {PRINTER_BRANDS.map(b => (
                                            <FormSelectOption key={b.value} label={b.label} value={b.value} />
                                        ))}
                                    </FormSelect>
                                </GridItem>
                            </Grid>

                            <Grid>
                                <GridItem span={3}>
                                    <Content>{'PRINTER MODEL:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <FormSelect
                                        id="printer-model"
                                        isDisabled={!tempPrinter?.brand}
                                        value={tempPrinter?.model ?? ''}
                                        onChange={(_event, value: string) => setTempPrinter({ ...tempPrinter, model: value })}
                                        aria-label="Select printer model"
                                    >
                                        <FormSelectOption key="placeholder" label={tempPrinter?.brand ? 'Select a model' : 'Select a brand first'} value="" />
                                        {(PRINTER_MODELS[tempPrinter?.brand || ''] || []).map(m => (
                                            <FormSelectOption key={m.value} label={m.label} value={m.value} />
                                        ))}
                                    </FormSelect>
                                </GridItem>
                            </Grid>

                            <Grid>
                                <GridItem span={3}>
                                    <Content>{'NAME:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInput
                                        id='printer-name'
                                        placeholder=""
                                        value={tempPrinter?.name}
                                        onChange={(_event, value: string) => setTempPrinter({ ...tempPrinter, name: value })}
                                    />
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
                                    <Grid>
                                        <GridItem span={3}>
                                            <Content>{'ACCESS CODE:'}</Content>
                                        </GridItem>
                                        <GridItem span={8}>
                                            <TextInputGroup>
                                                <TextInputGroupMain id='printer-connection-accesscode' value={tempPrinter?.access_code} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, access_code: value })} />
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
                        </FormGroup>
                    </GridItem>

                </Grid>

                <ModalFooter className="pf-custom-new-print-job-modal-footer">
                    <Button
                        variant="secondary"
                        onClick={() => { levelBed(printer[printerIndex!].id) }}
                    >
                        {'Level Bed'}
                    </Button>

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