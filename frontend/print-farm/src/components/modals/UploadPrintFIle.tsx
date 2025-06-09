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
} from '@patternfly/react-core';
import readFile from '../../representations/readFileRepresentation';
import { UploadIcon } from '@patternfly/react-icons';
import { uploadFile } from '../../ottoengine_API';

export default function uploadPrintFile() {
    const { setIsPrintTaskModalOpen, setIsFileUploadModalOpen, setCurrentFiles, currentFiles, fileUploadModalOpen } = useContext(JobContext);
    const [readFileData, setReadFileData] = useState<readFile[]>([]);
    const [showStatus, setShowStatus] = useState(false);
    const [statusIcon, setStatusIcon] = useState('inProgress');

    useEffect(() => {
        if (readFileData.length < currentFiles?.length) {
            setStatusIcon('inProgress');
        } else if (readFileData.every((file) => file.loadResult === 'success')) {
            setStatusIcon('success');
        } else {
            setStatusIcon('danger');
        }
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

    const uploadPrintFile = async () => {
        setIsFileUploadModalOpen(false);
        setIsPrintTaskModalOpen(true);
        await uploadFile(currentFiles[0], 1);
        const readCurrentFile = currentFiles.map((item: any) => String(item)).join('\n');
    }

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
                <Button
                    className="pf-m-danger"
                    onClick={() => setIsFileUploadModalOpen(false)}
                >
                    {'Close'}
                </Button>
                <Button
                    isDisabled={currentFiles?.length == 0}
                    className="pf-custom-button"
                    onClick={() => uploadPrintFile()}
                >
                    {'Continue'}
                </Button>
            </ModalFooter>
        </Modal>
    );
};