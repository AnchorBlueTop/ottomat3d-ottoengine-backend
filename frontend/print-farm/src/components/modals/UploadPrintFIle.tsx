import { JobContext } from '../../App';
import { useContext, useEffect, useState } from 'react';
import {
    MultipleFileUpload,
    MultipleFileUploadMain,
    MultipleFileUploadStatusItem,
    HelperText,
    HelperTextItem,
    DropEvent,
    Modal,
    Button,
    ModalFooter,
    FormSelect,
    FormSelectOption,
} from '@patternfly/react-core';
import readFile from '../../representations/readFileRepresentation';
import { UploadIcon } from '@patternfly/react-icons';
import { uploadFile } from '../../ottoengine_API';
import newPrintJob from './newPrintJob';

export default function uploadPrintFile() {
    const { setIsPrintTaskModalOpen, setIsFileUploadModalOpen, setCurrentFiles, setPrintFile, printJobUID, setPrintJobUID, currentFiles, fileUploadModalOpen, printer } = useContext(JobContext);
    const [readFileData, setReadFileData] = useState<readFile[]>([]);
    const [showStatus, setShowStatus] = useState(false);
    const [statusIcon, setStatusIcon] = useState('inProgress');
    // const [tempPrinter, setTempPrinter] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    var uniqueId: number | string = '';

    const [nextItemId, setNextItemId] = useState<number>(1);

    const generateJobId = () => {
        // uniqueId = (Math.random().toString(36).substring(2));
        uniqueId = Date.now() + Math.floor(Math.random() * 100);
        setPrintJobUID(uniqueId);
        return uniqueId;
    };

    useEffect(() => {
        if (readFileData.length < currentFiles?.length) {
            setStatusIcon('inProgress');
        } else if (readFileData.every((file) => file.loadResult === 'success')) {
            setStatusIcon('success');
        } else {
            setStatusIcon('danger');
        }

        generateJobId();
    }, [readFileData]);

    if (!showStatus && currentFiles?.length > 0) {
        setShowStatus(true);
    }

    const removeFiles = (namesOfFilesToRemove: string[]) => {
        const newCurrentFiles = currentFiles.filter(
            (currentFile: any) => !namesOfFilesToRemove.some((fileName) => fileName === currentFile.name)
        );

        setCurrentFiles(newCurrentFiles);

        const newReadFiles = readFileData.filter(
            (readFile) => !namesOfFilesToRemove.some((fileName) => fileName === readFile.fileName)
        );

        setReadFileData(newReadFiles);
    };

    const updateCurrentFiles = (files: File[]) => {
        setCurrentFiles((prevFiles: any) => [...prevFiles, ...files]);
    };

    const handleFileDrop = (_event: DropEvent, droppedFiles: File[]) => {
        const currentFileNames = currentFiles.map((file: any) => file.name);
        const reUploads = droppedFiles.filter((droppedFile) => currentFileNames.includes(droppedFile.name));

        Promise.resolve()
            .then(() => removeFiles(reUploads.map((file: any) => file.fileName)))
            .then(() => updateCurrentFiles(droppedFiles));
    };

    const handleReadSuccess = (data: string, file: File) => {
        setReadFileData((prevReadFiles) => [...prevReadFiles, { data, fileName: file.name, loadResult: 'success' }]);
    };

    const handleReadFail = (error: DOMException, file: File) => {
        setReadFileData((prevReadFiles) => [
            ...prevReadFiles,
            { loadError: error, fileName: file.name, loadResult: 'danger' }
        ]);
    };

    const createHelperText = (file: File) => {
        const fileResult = readFileData.find((readFile) => readFile.fileName === file.name);
        if (fileResult?.loadError) {
            return (
                <HelperText isLiveRegion>
                    <HelperTextItem variant="error">{fileResult.loadError.toString()}</HelperTextItem>
                </HelperText>
            );
        }
    };
    
    // const generateFileId = () => {
    //     return `file_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    // };

    const uploadPrintFile = async () => {
        // setIsFileUploadModalOpen(false);
        // setIsPrintTaskModalOpen(true);
        // await uploadFile(currentFiles[0], tempPrinter);
        // const readCurrentFile = currentFiles.map((item: any) => String(item)).join('\n');
        if (currentFiles.length === 0) {
            setErrorMessage("Please upload at least one file.");
            return;
        }
    
        try {
            for (const file of currentFiles) {
                if (!['.gcode', '.3mf'].some((ext) => file.name.endsWith(ext))) {
                    console.error("Unsupported file type:", file.name);
                    setErrorMessage("Unsupported file type. Please upload a .gcode or .3mf file.");
                    return;
                }
    
                const uploadedFile = await uploadFile(file, Number(printJobUID));
                setPrintFile(uploadedFile); // Set the uploaded file data
                console.log("Uploaded file response:", uploadedFile);
                setPrintJobUID(uploadedFile.print_item_id);
            }
    
            setErrorMessage(null); 
            setIsFileUploadModalOpen(false);
            setIsPrintTaskModalOpen(true);
        } catch (error) {
            setErrorMessage("Failed to upload file. Please try again.");
        }
    }

    // const handlePrinterChange = (printerId: any) => {
    //     setTempPrinter(printerId);
    // };

    return (
        <Modal
            isOpen={fileUploadModalOpen}
            className="pf-custom-print-task-modal pf-v6-u-box-shadow-lg"
            aria-label="add-print-task-modal"
        >
            {currentFiles.length == 0 ? (<MultipleFileUpload
                onFileDrop={handleFileDrop}
                dropzoneProps={{
                    accept: {
                        'application/gcode': ['.gcode', '.3mf']
                    }
                }}
            >
                <MultipleFileUploadMain
                    titleIcon={<UploadIcon />}
                    titleText="Drag and drop files here"
                    titleTextSeparator="or"
                    infoText="Accepted file types: GCODE"
                />
                {showStatus && (
                    <>
                        {currentFiles.map((file: any) => (
                            <MultipleFileUploadStatusItem
                                file={file}
                                key={file.name}
                                onClearClick={() => removeFiles([file.name])}
                                onReadSuccess={handleReadSuccess}
                                onReadFail={handleReadFail}
                                progressHelperText={createHelperText(file)}
                            />
                        ))}
                    </>
                )}
            </MultipleFileUpload>) : <>
                {showStatus && (
                    <>
                        {currentFiles.map((file: any, index) => (
                            <MultipleFileUploadStatusItem
                                file={file}
                                key={index}
                                onClearClick={() => removeFiles([file.name])}
                                onReadSuccess={handleReadSuccess}
                                onReadFail={handleReadFail}
                                progressHelperText={createHelperText(file)}
                            />
                        ))}
                    </>
                )}</>
            }
            <ModalFooter className='pf-custom-upload-button-footer'>
                {/* <FormSelect
                    value={tempPrinter || ""}
                    onChange={(_event, value) => handlePrinterChange(value)}
                    aria-label={`Select printer for Uploading`}
                >
                    <FormSelectOption key="default" value="" label="Select a printer" isDisabled />
                    {printer.map((printerItem, printerIndex) => (
                        <FormSelectOption
                            key={printerIndex}
                            value={printerItem.id}
                            label={printerItem.model as string}
                        />
                    ))}
                </FormSelect> */}
                
                <Button
                    className="pf-m-danger"
                    onClick={() => setIsFileUploadModalOpen(false)}
                >
                    {'Close'}
                </Button>
                <Button
                    // isDisabled={currentFiles?.length === 0 || !tempPrinter}
                    isDisabled={currentFiles?.length === 0}
                    className="pf-custom-button"
                    onClick={() => uploadPrintFile()}
                >
                    {'Continue'}
                </Button>
            </ModalFooter>
            {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
        </Modal>
    );
};