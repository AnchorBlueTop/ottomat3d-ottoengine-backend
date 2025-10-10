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
import { useContext, useState } from "react";
import { JobContext } from "../../App.tsx";
import printerIcon from '../../public/printer-Icon.svg';
import thumbnail from '../../public/thumbnail.png';
import { PrinterRegistrationRepresentation } from "../../representations/printerRepresentation.ts";
import { registerPrinter } from "../../ottoengine_API.ts";

export default function newPrinter() {
    const { printer, setPrinter, printerAddModalOpen, setIsPrinterAddModalOpen } = useContext(JobContext);
    const [tempPrinter, setTempPrinter] = useState<PrinterRegistrationRepresentation>();

    const updatePrinterList = (tempPrinter: any) => {
        // if (!printer && tempPrinter) {
        //     console.log(tempPrinter);
        //     const registeredResponse = registerPrinter(tempPrinter).then(() => { console.log('in printer registration') });
        //     setPrinter([tempPrinter]);
        //     setTempPrinter({});
        // } else {
        //     if (!printer[0]) {
        //         delete printer[0];
        //         printer.push(tempPrinter);

        //         setPrinter(printer);
        //         setTempPrinter({});
        //     } else {
        //         const registeredResponse = registerPrinter(tempPrinter).then(() => { console.log('in printer registration') });
        //         printer.push(tempPrinter);
        //         setPrinter(printer);
        //         setIsPrinterAddModalOpen(false);
        //         setTempPrinter({});
        //     }
        // }

        if (!tempPrinter) {
            console.error("No printer data provided.");
            return;
        }
        // Register the printer using the API
        registerPrinter(tempPrinter).then(() => {
            console.log("Printer registered successfully:", tempPrinter);

            // Update the printer list
            if (!printer || printer.length === 0) {
                // If no printers exist, initialize the printer list
                setPrinter([tempPrinter]);
            } else {
                // Add the new printer to the existing list
                setPrinter([...printer, tempPrinter]);
            }

            // Reset the temporary printer and close the modal
            setTempPrinter({});
            setIsPrinterAddModalOpen(false);
        })
        .catch((error) => {
            console.error("Error registering printer:", error);
        });
        setIsPrinterAddModalOpen(false);
    };

    return (
        <>
            <Modal
                isOpen={printerAddModalOpen}
                className="pf-custom-new-printer-modal"
                aria-label="newPrinter"
            >
                <PageSection className="pf-custom-new-printer">
                    <ModalHeader className="pf-custom-upload-header">
                        <Content component={ContentVariants.h3}>
                            <Brand src={printerIcon} alt="Printer logo" className='pf-custom-modal-icon' />
                            {' ADD NEW PRINTER'}</Content>
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
                                            placeholder=""
                                            value={tempPrinter?.name}
                                            onChange={(_event, value: string) => setTempPrinter({ ...tempPrinter, name: value })}
                                        />
                                    </GridItem>
                                </Grid>

                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'PRINTER BRAND:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        <TextInputGroup>
                                            <TextInputGroupMain id='printer-brand' value={tempPrinter?.brand} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, brand: value })} />
                                        </TextInputGroup>
                                    </GridItem>
                                </Grid>

                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'PRINTER MODEL:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        <TextInputGroup>
                                            <TextInputGroupMain id='printer-model' value={tempPrinter?.model} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, model: value })} />
                                        </TextInputGroup>
                                    </GridItem>
                                </Grid>
                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'TYPE:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        <TextInputGroup>
                                            <TextInputGroupMain placeholder='eg. FDM' id='printer-type' value={tempPrinter?.type} onChange={(_event, value: any) => setTempPrinter({ ...tempPrinter, type: value })} />
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
                            variant="danger"
                            onClick={() => { setIsPrinterAddModalOpen(false) }}
                        >
                            {'Cancel'}
                        </Button>
                        <Button
                            className="pf-custom-button"
                            onClick={() => {
                                if (tempPrinter) {
                                    updatePrinterList(tempPrinter);
                                } else {
                                    console.error("No printer data to add.");
                                }
                            }}
                        >
                            {'ADD'}
                        </Button>
                    </ModalFooter>
                </PageSection>
            </Modal>
        </>
    )
}