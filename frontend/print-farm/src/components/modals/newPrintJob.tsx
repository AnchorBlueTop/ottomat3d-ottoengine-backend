import { Brand, Button, Card, CardHeader, Content, ContentVariants, Form, FormGroup, Grid, GridItem, Modal, ModalFooter, ModalHeader, PageSection } from "@patternfly/react-core";
import { Component, useContext, useDebugValue, useEffect, useState } from "react";
import { JobContext } from "../../App";
import PrintJobIcon from '../../public/PrintJob-Icon.svg'
import thumbnail from '../../public/thumbnail.png';
import PrintJobRepresentation from "../../representations/printJobRepresentation";

export default function newPrintJob() {
    const { printer, setPrinter, currentFiles, printTaskModalOpen, setIsPrintTaskModalOpen, setCurrentFiles, printJob, setPrintJob, setPrintFile, printFile } = useContext(JobContext);
    const [fileRead, setFileRead] = useState();
    var uniqueId: number | string = '';
    var fileDetails: PrintJobRepresentation = {};

    const generateJobId = () => {
        const timestamp = new Date().getTime();
        uniqueId = (Math.random().toString(36).substring(2));
        return uniqueId;
    };

    const readUploadedFile = (file: any[]): Promise<string | any> => {
        const fileRead = new Promise((resolve, reject) => {
            const reader = new FileReader();
            if (file?.[0]) {
                
                reader.onload = (event) => {
                    const result = event.target?.result as string;
                    const processedResult = result.split('\n').map((item: any) => String(item)).join('\n');
                    setCurrentFiles([processedResult]);

                    //PRINTER MODEL EXTRACT
                    const printerRegex = /printer_model = (.*)/;
                    const matchPrinter = processedResult.match(printerRegex);
                    const matchedPrinter = () => {
                        if (matchPrinter && matchPrinter[1]) {
                            return matchPrinter[1].trim();
                        } else {
                            return 'Unknown Printer';
                        }
                    }

                    // PRINTFILE DURATION EXTRACT 
                    const printDurationRegex = /total estimated time: (.*)/;
                    const matchPrintDuration = processedResult.match(printDurationRegex);
                    const matchedPrintDuration = () => {
                        if (matchPrintDuration && matchPrintDuration[1]) {
                            return matchPrintDuration[1].trim();
                        } else {
                            return 'Unknown Duration';
                        }
                    }

                    // PRINTFILE FILAMENT_TYPE EXTRACT 
                    const printFilamentTypeRegex = /filament_type = (.*)/;
                    const matchFilamentType = processedResult.match(printFilamentTypeRegex);
                    const matchedFilamentType = () => {
                        if (matchFilamentType && matchFilamentType[1]) {
                            return matchFilamentType[1].trim();
                        } else {
                            return 'Unknown Filament Type';
                        }
                    }

                    // PRINTFILE FILAMENT_REQ_WEIGHT EXTRACT 
                    const printFilamentWeightRegex = /total filament weight \[g\] : (.*)/;
                    const matchFilamentWeight = processedResult.match(printFilamentWeightRegex);
                    const matchedFilamentWeight = () => {
                        if (matchFilamentWeight && matchFilamentWeight[1]) {
                            return matchFilamentWeight[1].trim() + ' (grams)';
                        } else {
                            return 'Unknown Filament Weight';
                        }
                    }

                    // PRINTFILE FILAMENT_REQ_LENGTH EXTRACT 
                    const printFilamentLengthRegex = /total filament length \[mm\] : (.*)/;
                    const matchFilamentLength = processedResult.match(printFilamentLengthRegex);
                    const matchedFilamentLength = () => {
                        if (matchFilamentLength && matchFilamentLength[1]) {
                            return matchFilamentLength[1].trim() + ' (mm)';
                        } else {
                            return 'Unknown Filament Length';
                        }
                    }

                    fileDetails = {
                        id: uniqueId.toString(),
                        name: file?.[0]?.name,
                        printer: matchedPrinter(),
                        duration: matchedPrintDuration(),
                        filament: matchedFilamentType(),
                        filament_weight: matchedFilamentWeight(),
                        filament_length: matchedFilamentLength(),
                        status: 'NEW'
                    }
                    setPrintFile(fileDetails);
                    return result;
                }

                if (file && file[0] instanceof Blob) {
                    reader.readAsText(file[0]);
                }
            }
        });
        return fileRead;
    };

    useEffect(() => {
        generateJobId();
        readUploadedFile(currentFiles);
    }, [printTaskModalOpen]);

    return (
        <Modal
            isOpen={printTaskModalOpen}
            className="pf-custom-new-print-job-modal"
            aria-label="newPrintJob"
        >
            <PageSection className="pf-custom-new-print-job">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        <Brand src={PrintJobIcon} alt="Upload logo" className='pf-custom-upload-icon' />
                        {' NEW PRINT JOB'}</Content>
                </ModalHeader>
                <Grid hasGutter>
                    <GridItem span={8}>
                        <Form isHorizontal className="pf-custom-text-align-left">

                            <Content component={ContentVariants.h6}>{'DETAILS'}</Content>
                            <FormGroup className="pf-custom-formGroup" label={'ID: '}>
                                {printFile?.id}
                            </FormGroup>

                            <FormGroup className="pf-custom-formGroup" label={'PRINTER: '}>
                                {printFile?.printer}
                            </FormGroup>

                            <FormGroup className="pf-custom-formGroup" label={'MATERIAL: '}>
                                {printFile?.filament}
                            </FormGroup>

                            <FormGroup className="pf-custom-formGroup" label={'MATERIAL REQUIRED: '}>
                                {printFile?.filament_weight}
                            </FormGroup>

                            <FormGroup className="pf-custom-formGroup" label={'DURATION: '}>
                                {printFile?.duration}
                            </FormGroup>

                        </Form>
                    </GridItem>

                    <GridItem span={4}>
                        <FormGroup>
                            <Brand src={thumbnail} alt={"print job thumbnail"} className="pf-custom-thumbnail" />
                        </FormGroup>
                    </GridItem>

                    <GridItem span={12}>
                        <div className="pf-c-form-group">
                            <span className="pf-custom-border-label"><strong>{'FILE: '}</strong></span>
                            <Content>{printFile?.name}</Content>
                        </div>
                    </GridItem>
                </Grid>

                <ModalFooter className="pf-custom-new-print-job-modal-footer">
                    <Button
                        isDisabled={currentFiles?.length === 0}
                        variant="danger"
                        onClick={() => { setIsPrintTaskModalOpen(false) }}
                    >
                        {'Cancel'}
                    </Button>
                    <Button
                        isDisabled={currentFiles?.length === 0}
                        className="pf-custom-button"
                        onClick={() => {
                            setPrintJob((prevJob) => [...prevJob, printFile]),
                                setIsPrintTaskModalOpen(false)
                        }}
                    >
                        {'CREATE'}
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    )

}