import { JobContext } from './App';
import { useContext, useEffect, useState } from 'react';
import {
  MultipleFileUpload,
  MultipleFileUploadMain,
//   MultipleFileUploadStatus,
  MultipleFileUploadStatusItem,
  HelperText,
  HelperTextItem,
  DropEvent,
  Modal,
  Button,
  ModalFooter,
  PageSection,
  Content,
  Brand,
  Card,
  CardHeader,
  CardTitle,
  ContentVariants
} from '@patternfly/react-core';
import UploadIcon from '@patternfly/react-icons/dist/esm/icons/upload-icon';
import uploadBox from './public/box_icon.png';
import readFile from './readFileRepresentation';

export default function addPrintTask() {
    const { setIsPrintTaskModalOpen, setIsFileUploadModalOpen, setCurrentFiles, currentFiles, fileUploadModalOpen } = useContext(JobContext);
    
    const [readFileData, setReadFileData] = useState<readFile[]>([]);
    const [showStatus, setShowStatus] = useState(false);
    const [statusIcon, setStatusIcon] = useState('inProgress');

    console.log("IN ADD PRINT TASK")

    useEffect(() => {
        if (readFileData.length < currentFiles.length) {
        setStatusIcon('inProgress');
        } else if (readFileData.every((file) => file.loadResult === 'success')) {
        setStatusIcon('success');
        } else {
        setStatusIcon('danger');
        }
    }, [readFileData, currentFiles]);

    // only show the status component once a file has been uploaded, but keep the status list component itself even if all files are removed
    if (!showStatus && currentFiles.length > 0) {
        setShowStatus(true);
    }

    // determine the icon that should be shown for the overall status list
   

    // remove files from both state arrays based on their name
    const removeFiles = (namesOfFilesToRemove: string[]) => {
        const newCurrentFiles = currentFiles.filter(
        (currentFile) => !namesOfFilesToRemove.some((fileName) => fileName === currentFile.name)
        );

        setCurrentFiles(newCurrentFiles);

        const newReadFiles = readFileData.filter(
        (readFile) => !namesOfFilesToRemove.some((fileName) => fileName === readFile.fileName)
        );

        setReadFileData(newReadFiles);
    };

    /** Forces uploaded files to become corrupted if "Demonstrate error reporting by forcing uploads to fail" is selected in the example,
     * only used in this example for demonstration purposes */
    const updateCurrentFiles = (files: readFile[]) => {
        setCurrentFiles((prevFiles) => [...prevFiles, ...files]);
    };

    // callback that will be called by the react dropzone with the newly dropped file objects
    const handleFileDrop = (_event: DropEvent, droppedFiles: readFile[]) => {
        // identify what, if any, files are re-uploads of already uploaded files
        const currentFileNames = currentFiles.map((file) => file.fileName);
        const reUploads = droppedFiles.filter((droppedFile) => currentFileNames.includes(droppedFile.fileName));

        /** this promise chain is needed because if the file removal is done at the same time as the file adding react
         * won't realize that the status items for the re-uploaded files needs to be re-rendered */
        Promise.resolve()
        .then(() => removeFiles(reUploads.map((file:any) => file.fileName)))
        .then(() => updateCurrentFiles(droppedFiles));
    };

    // callback called by the status item when a file is successfully read with the built-in file reader
    const handleReadSuccess = (data: string, file: readFile) => {
        setReadFileData((prevReadFiles) => [...prevReadFiles, { data, fileName: file.fileName, loadResult: 'success' }]);
    };

    // callback called by the status item when a file encounters an error while being read with the built-in file reader
    const handleReadFail = (error: DOMException, file: readFile) => {
        setReadFileData((prevReadFiles) => [
        ...prevReadFiles,
        { loadError: error, fileName: file.fileName, loadResult: 'danger' }
        ]);
    };

    // add helper text to a status item showing any error encountered during the file reading process
    const createHelperText = (file: readFile) => {
        const fileResult = readFileData.find((readFile) => readFile.fileName === file.fileName);
        if (fileResult?.loadError) {
        return (
            <HelperText isLiveRegion>
            <HelperTextItem variant="error">{fileResult.loadError.toString()}</HelperTextItem>
            </HelperText>
        );
        }
    };

    // const successfullyReadFileCount = readFileData.filter((fileData) => fileData.loadResult === 'success').length;


    const uploadPrintFile = () => {
        setIsFileUploadModalOpen(false);
        setIsPrintTaskModalOpen(true);
        console.log(currentFiles);
        console.log(currentFiles[0].path)
    }

    return (
        <>
        {fileUploadModalOpen ? 
        // <PageSection className='pf-custom-print-task'>
            <Card className='pf-custom-print-task'>
          <CardHeader className='pf-custom-upload-header'>
            <Content component={ContentVariants.h3}>
            <Brand src={uploadBox} alt="Upload logo" className='pf-custom-upload-icon'/>
            {' NEW PRINT JOB'}</Content>
          </CardHeader>
          
        
        {/* <Modal
            isOpen={fileUploadModalOpen}
            className="pf-custom-print-task-modal pf-v6-u-box-shadow-lg"
            aria-label="add-print-task-modal"
        > */}
            {currentFiles.length==0 ? (<MultipleFileUpload
                    onFileDrop={handleFileDrop}
                    dropzoneProps={{
                    accept: {
                        'application/gcode': ['.gcode']
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
                    {currentFiles.map((file) => (
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
                    {currentFiles.map((file) => (
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
                )}</>
            }
            {/* <br/> */}
            {/* <ModalFooter> */}
            <PageSection className='pf-custom-upload-button-footer'>
                <Button 
                    isDisabled={currentFiles.length==0}
                    className="pf-custom-button"
                    onClick={() => uploadPrintFile()}
                >
                    {'Continue'}
                </Button>
                <Button 
                    className="pf-m-danger"
                    onClick={() => setIsFileUploadModalOpen(false)}
                >
                    {'Close'}
                </Button>
            </PageSection>
            {/* </ModalFooter> */}
        {/* </Modal> */}
        {/* </PageSection> */}
        </Card> : '' }
        </>
    );
};