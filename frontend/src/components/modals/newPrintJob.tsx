import { Brand, Button, Content, ContentVariants, Form, FormGroup, Grid, GridItem, Modal, ModalFooter, ModalHeader, PageSection } from "@patternfly/react-core";
import { useContext, useEffect, useRef, useState } from "react";
import { JobContext } from "../../App";
import PrintJobIcon from '../../public/PrintJob-Icon.svg'
import thumbnail from '../../public/thumbnail.png';
import PrintJobRepresentation from "../../representations/printJobRepresentation";
import JSZip from 'jszip';
import { PrinterRepresentation } from "../../representations/printerRepresentation";
import { getAllOttoejectDevices, getAllPrinters, getPrintJobById, uploadFile } from "../../ottoengine_API";
import { createPrintJob, getAllPrintJobs } from "../../ottoengine_API";
import { get } from "http";

export default function newPrintJob() {
    // const { currentFiles, printTaskModalOpen, setIsPrintTaskModalOpen, setCurrentFiles, setPrintJobUID, printJobUID, setOttoeject, ottoeject, setPrintFile, printFile } = useContext(JobContext);
    const {
        currentFiles, printTaskModalOpen, setIsPrintTaskModalOpen, setCurrentFiles,
        setPrintJobUID, printJobUID, setOttoeject, ottoeject, setPrintFile, printFile,
        setPrintJob
      } = useContext(JobContext);
    const [fileRead, setFileRead] = useState();
    const [printers, setPrinters] = useState<PrinterRepresentation[]>([]);
    const [selectedPrinter, setSelectedPrinter] = useState<number | null>(null);
    const [selectedOttoeject, setSelectedOttoeject] = useState<number | null>(null);
    const modalDataFetchedRef = useRef(false);
    const [nextItemId, setNextItemId] = useState<number>(1);
    
    var uniqueId: number | string = '';
    // var fileDetails: PrintJobRepresentation = {};
    var fileDetails: any = {};

    const refreshJobs = async () => {
        try {
          const all = await getAllPrintJobs();
          setPrintJob(all);
        } catch (e) {
          console.error('Failed to refresh print jobs', e);
        }
    };

    // const generateJobId = () => {
    //     uniqueId = (Math.random().toString(36).substring(2));
    //     setPrintJobUID(uniqueId);
    //     return uniqueId;
    // };

    const readUploadedFile = (file: any[]): Promise<string | any> => {
        const fileRead = new Promise(async () => {
            const reader = new FileReader();
            if (file?.[0] && !file?.[0].name?.includes('3mf')) {

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

                    // PRINTFILE AMS EXTRACT 
                    const printAMSRegex = /M620(.*)|M621(.*)/;
                    const matchAMS = processedResult.match(printAMSRegex);
                    const matchedAMS = () => {
                        if (matchAMS && matchAMS[1]) {
                            return true;
                        } else {
                            return false;
                        }
                    }

                    fileDetails = {
                        // id: uniqueId.toString(),
                        id: printJobUID?.toString(),
                        name: file?.[0]?.name,
                        printer: matchedPrinter(),
                        duration: matchedPrintDuration(),
                        filament: matchedFilamentType(),
                        filament_weight: matchedFilamentWeight(),
                        filament_length: matchedFilamentLength(),
                        status: 'NEW',
                        ams: matchedAMS()
                    }
                    setPrintFile(fileDetails);
                    return result;
                };

                if (file && file[0] instanceof Blob) {
                    reader.readAsText(file[0]);
                }
            } else if (file?.[0] && file?.[0].name?.includes('3mf')) {
                try {
                    const zip = new JSZip();

                    // Read the .3mf file as a ZIP archive
                    const fileData = await file[0]?.arrayBuffer();
                    const zipContent = await zip.loadAsync(fileData);

                    // Find the main XML file (e.g., ".gcode")
                    const mainFile = Object.keys(zipContent.files).find((fileName) =>
                        fileName.toLowerCase().endsWith('.gcode')
                    );
                    const fileContent = await zipContent.files[mainFile!].async('text');
                    if (typeof mainFile === 'string') {
                        const processedResult = fileContent.split('\n').map((item: any) => String(item)).join('\n');
                        setCurrentFiles([processedResult]);
                        // console.log(processedResult);
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

                        // PRINTFILE AMS EXTRACT 
                        const printAMSRegex = /M620(.*)|M621(.*)/;
                        const matchAMS = processedResult.match(printAMSRegex);
                        const matchedAMS = () => {
                            if (matchAMS && matchAMS[1]) {
                                return true;
                            } else {
                                return false;
                            }
                        }

                        fileDetails = {
                            // id: uniqueId.toString(),
                            id: printJobUID?.toString(),
                            name: file?.[0]?.name,
                            printer: matchedPrinter(),
                            duration: matchedPrintDuration(),
                            filament: matchedFilamentType(),
                            filament_weight: matchedFilamentWeight(),
                            filament_length: matchedFilamentLength(),
                            status: 'NEW', 
                            ams: matchedAMS()
                        }
                        setPrintFile(fileDetails);
                        // console.log(fileDetails);
                        return processedResult;
                    }
                } catch (error) {
                    console.error('Error processing .3mf file:', error);
                }
            }
        });
        return fileRead;
    };

    // // Use `nextItemId` when creating a new print job
    // const handleCreatePrintJob = async () => {
    //     const printJobData = {
    //         print_item_id: nextItemId,
    //         printer_id: printers.find((printer) => printer.name === selectedPrinter)?.id,
    //         priority: 1,
    //         auto_start: true,
    //     };

    //     try {
    //         const newPrintJob = await createPrintJob(printJobData);
    //         console.log("Print job created successfully:", newPrintJob);
    //         setNextItemId(nextItemId + 1); // Increment for the next job
    //     } catch (error) {
    //         console.error("Error creating print job:", error);
    //     }
    // };


    // const readUploadedFile = async (file: any[]) => {
    //     try {
    //         if(printTaskModalOpen){
    //             console.log('printFile: ', printFile.parsed_data);
    //             // const uploadedFile = await getPrintJobById(printFile);
    //             const uploadedFile = printFile.parsed_data;
            
    
    //             // Set the `printFile` state with the data returned from the API
    //             // setPrintFile({
    //             //     id: uploadedFile.id,
    //             //     name: uploadedFile.name,
    //             //     printer: uploadedFile.printer,
    //             //     duration: uploadedFile.duration,
    //             //     filament: uploadedFile.filament,
    //             //     filament_weight: uploadedFile.filament_weight,
    //             //     filament_length: uploadedFile.filament_length,
    //             //     status: 'NEW',
    //             //     ams: uploadedFile.ams,
    //             // });

    //             setPrintFile({
    //                 // id: uploadedFile.id,
    //                 name: uploadedFile.file_name,
    //                 printer: uploadedFile.printer,
    //                 duration: uploadedFile.duration,
    //                 // filament: uploadedFile.filament,
    //                 filament_weight: uploadedFile.filament_used,
    //                 // filament_length: uploadedFile.filament_length,
    //                 status: 'NEW',
    //                 ams: uploadedFile.ams,
    //             });
        
    //             console.log("Uploaded file data:", uploadedFile);
    //         }
    //     } catch (error) {
    //         console.error("Error reading uploaded file:", error);
    //     }
    // };

    const handleCreatePrintJob = async () => {
        if (!selectedPrinter ||  !selectedOttoeject) {
            console.error("No printer selected.");
            // setErrorMessage("Please select a printer before creating a print job.");
            return;
        }
    
        const printJobData = {
            print_item_id: nextItemId,
            printer_id: selectedPrinter,
            ottoeject_id: selectedOttoeject,
            auto_start: true,
        };
    
        try {
            console.log("Creating print job with data:", printJobData);
            const newPrintJob = await createPrintJob(printJobData);
            console.log("Print job created successfully:", newPrintJob);
            setNextItemId(nextItemId + 1); // Increment for the next job
            await refreshJobs();
        } catch (error) {
            console.error("Error creating print job:", error);
            // setErrorMessage("Failed to create print job. Please try again.");
        }
        setIsPrintTaskModalOpen(!printTaskModalOpen)
    };
    // const handleCreatePrintJob = async (payload: any) => {
    //     try {
    //       // ...existing code that uploads file/builds payload...
    //       const created = await createPrintJob(payload);
    
    //       // Refresh the shared list so Jobs.tsx re-renders
    //       await refreshJobs();
    
    //       // Close modal and cleanup (optional)
    //       setIsPrintTaskModalOpen(false);
    //       setCurrentFiles([]);
    //       // setPrintFile(undefined);
    //     } catch (e) {
    //       console.error('Failed to create print job', e);
    //     }
    // };

    // useEffect(() => {
    //     const fetchPrintJobs = async () => {
    //         try {
    //             const printJobs = await getAllPrintJobs();
    //             if (printJobs.length > 0) {
    //                 const highestId = Math.max(...printJobs.map((job) => job.print_item_id || 0));
    //                 setNextItemId(highestId + 1);
    //             } else {
    //                 setNextItemId(1); // Start with 1 if no print jobs exist
    //             }
    //         } catch (error) {
    //             console.error("Error fetching print jobs:", error);
    //         }
    //     };
    //     const fetchPrinters = async () => {
    //         try {
    //             const printerList = await getAllPrinters();
    //             setPrinters(printerList);
    //         } catch (error) {
    //             console.error("Error fetching printers:", error);
    //         }
    //     };
    //     const fetchOttoejectDevices = async () => {
    //         try {
    //             const devices = await getAllOttoejectDevices();
    //             setOttoeject(devices);
    //         } catch (error) {
    //             console.error("Error fetching Ottoeject devices:", error);
    //         }
    //     };

    //     fetchOttoejectDevices();
    //     fetchPrinters();
    //     fetchPrintJobs();
    //     // generateJobId();
    //     readUploadedFile(currentFiles);
        
        

    //     // if (printFile?.printer) {
    //     //     setSelectedPrinter(printFile.printer);
    //     // }
    // }, [printTaskModalOpen, printFile]);


  useEffect(() => {
    if (!printTaskModalOpen) {
        modalDataFetchedRef.current = false; // reset when closed
        return;
      }
      if (modalDataFetchedRef.current) return;
      modalDataFetchedRef.current = true;
  
      let cancelled = false;
      (async () => {
        try {
          if (printers.length === 0) {
            const printerList = await getAllPrinters();
            if (!cancelled) setPrinters(printerList);
          }
          if (ottoeject.length === 0) {
            const devices = await getAllOttoejectDevices();
            if (!cancelled) setOttoeject(devices);
          }
          if (currentFiles?.length) {
            // This function sets state internally; it doesn't resolve, so don't await.
            readUploadedFile(currentFiles);
          }
        } catch (e) {
          console.error("Failed to load modal data", e);
        }
      })();
  
      return () => {
        cancelled = true;
      };
    }, [printTaskModalOpen]);

    return (
        <Modal
            isOpen={printTaskModalOpen}
            className="pf-custom-new-print-job-modal"
            aria-label="newPrintJob"
            onClose={() => setIsPrintTaskModalOpen(false)}
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

                            {/* <FormGroup className="pf-custom-formGroup" label={'PRINTER: '}>
                                {printFile?.printer}
                            </FormGroup> */}
                            {/* <FormGroup className="pf-custom-formGroup" label={'PRINTER: '}>
                                <select
                                    className="pf-custom-dropdown"
                                    value={selectedPrinter || ''}
                                    onChange={(e) => setSelectedPrinter(e.target.value)}
                                >
                                    {printers.map((printer) => (
                                        <option key={printer.id} value={printer.name}>
                                            {printer.name}
                                        </option>
                                    ))}
                                </select>
                            </FormGroup> */}
                            <FormGroup className="pf-custom-formGroup" label={'PRINTER: '}>
                                <select
                                    className="pf-custom-dropdown"
                                    value={selectedPrinter || ''}
                                    onChange={(e) => setSelectedPrinter(Number(e.target.value))}
                                >
                                    <option value="" disabled>Select a printer</option>
                                    {printers.map((printer) => (
                                        <option key={printer.id} value={printer.id}>
                                            {printer.name}
                                        </option>
                                    ))}
                                </select>
                            </FormGroup>

                            <FormGroup className="pf-custom-formGroup" label="OTTOEJECT">
                                <select
                                    className="pf-custom-dropdown"
                                    value={selectedOttoeject || ''}
                                    onChange={(e) => setSelectedOttoeject(Number(e.target.value))}
                                >
                                    <option value="" disabled>Select an Ottoeject device</option>
                                    {ottoeject.map((device) => (
                                        <option key={device.id} value={device.id}>
                                            {device.device_name}
                                        </option>
                                    ))}
                                </select>
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
                        isDisabled={currentFiles?.length === 0 || !selectedPrinter || !selectedOttoeject}
                        className="pf-custom-button"
                        onClick={handleCreatePrintJob}
                    >
                        {'CREATE'}
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    )

}