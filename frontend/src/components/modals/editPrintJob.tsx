import { Brand, Button, Content, ContentVariants, Form, FormGroup, Grid, GridItem, Modal, ModalFooter, ModalHeader, PageSection, Spinner } from "@patternfly/react-core";
import { useContext, useEffect, useMemo, useState } from "react";
import { JobContext } from "../../App";
import PrintJobIcon from '../../public/PrintJob-Icon.svg';
import { PrinterRepresentation } from "../../representations/printerRepresentation";
import { getAllPrinters, getAllPrintJobs, getPrintJobById, deletePrintJob } from "../../ottoengine_API";
import PrintJobRepresentation from "../../representations/printJobRepresentation";
import hourglass from '../../public/hourglass.png';
import thumbnail from '../../public/thumbnail.png';

export default function editPrintJob() {
    const {
        isEditPrintJobModalOpen,
        setIsEditPrintJobModalOpen,
        printJobUID,
        setPrintJob,
    } = useContext(JobContext);

    const [loading, setLoading] = useState(false);
    const [job, setJob] = useState<PrintJobRepresentation | null>(null);
    const [printers, setPrinters] = useState<PrinterRepresentation[]>([]);
    const [selectedPrinter, setSelectedPrinter] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const details = useMemo(() => {
        const parsed = job?.file_details_json ? safeParse(job.file_details_json) : {};
        return parsed || {};
    }, [job]);

    const refreshJobs = async () => {
        const all = await getAllPrintJobs();
        setPrintJob(all);
    };

    useEffect(() => {
        const load = async () => {
            if (!isEditPrintJobModalOpen || !printJobUID) return;
            setLoading(true);
            try {
                const [jobResp, printerList] = await Promise.all([
                    getPrintJobById(String(printJobUID)),
                    getAllPrinters().catch(() => [])
                ]);
                if (jobResp) {
                    setJob(jobResp);
                    setSelectedPrinter(jobResp.printer_id ?? null);
                }
                if (Array.isArray(printerList)) setPrinters(printerList);
            } catch (e) {
                console.error("Failed to load edit print job data", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isEditPrintJobModalOpen, printJobUID]);

    const close = () => {
        setIsEditPrintJobModalOpen(false);
        setJob(null);
        setSelectedPrinter(null);
    };

    const handleDelete = async () => {
        const idToDelete = printJobUID ?? job?.id;
        if (!idToDelete) return;

        try {
            setDeleting(true);
            await deletePrintJob(idToDelete);
            await refreshJobs();
            close();
        } catch (e) {
            console.error("Failed to delete print job", e);
        } finally {
            setDeleting(false);
        }
    };

    const handleSave = async () => {
        try {
            const all = await getAllPrintJobs();
            setPrintJob(all);
        } catch (e) {
            console.error("Failed to refresh jobs after edit", e);
        }
        close();
    };

    function safeParse(text?: string) {
        try { return text ? JSON.parse(text) : undefined; } catch { return undefined; }
    }

    const durationText = job?.duration || details?.duration || "-";
    const fileNameText = job?.fileName || details?.name || "-";
    const statusText = job?.status || details?.status || "Unknown";
  
    return (
        <Modal
            isOpen={isEditPrintJobModalOpen}
            onClose={close}
            className="pf-custom-new-print-job-modal"
            aria-label="editPrintJob"
        >
            <PageSection className="pf-custom-new-print-job">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        <Brand src={PrintJobIcon} alt="Edit logo" className='pf-custom-upload-icon' />
                        {' EDIT PRINT JOB'}
                    </Content>
                </ModalHeader>

                {loading ? (
                    <div className="pf-u-display-flex pf-u-justify-content-center pf-u-align-items-center" style={{ minHeight: 160 }}>
                        <Spinner size="lg" />
                    </div>
                ) : (
                    <Grid hasGutter>
                        <GridItem span={8}>
                            <Form isHorizontal className="pf-custom-text-align-left">
                                <Content component={ContentVariants.h6}>{'DETAILS'}</Content>

                                <FormGroup className="pf-custom-formGroup" label="ID">
                                    {job?.id ?? "-"}
                                </FormGroup>

                                <FormGroup className="pf-custom-formGroup" label="Filename">
                                    {fileNameText}
                                </FormGroup>

                                <FormGroup className="pf-custom-formGroup" label="Status">
                                    {statusText}
                                </FormGroup>

                                <FormGroup
                                  className="pf-custom-formGroup"
                                  label={<span className="pf-custom-duration"><img src={hourglass} alt="" className="pf-custom-duration-icon" />Duration</span>}
                                >
                                    {durationText}
                                </FormGroup>

                                <FormGroup className="pf-custom-formGroup" label="Linked Printer">
                                    <select
                                        className="pf-custom-dropdown"
                                        value={selectedPrinter ?? ''}
                                        onChange={(e) => setSelectedPrinter(e.target.value ? Number(e.target.value) : null)}
                                    >
                                        <option value="">Select a printer</option>
                                        {printers.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
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
                                <Content>{fileNameText}</Content>
                            </div>
                        </GridItem>
                    </Grid>
                )}

                <ModalFooter className="pf-custom-new-print-job-modal-footer">
                    <Button
                        variant="danger"
                        onClick={handleDelete}
                        isLoading={deleting}
                    >
                        {deleting ? "Deleting…" : "Delete"}
                    </Button>
                    <Button variant="secondary" onClick={close} isDisabled={deleting}>
                        Cancel
                    </Button>
                    <Button className="pf-custom-button" onClick={handleSave} isDisabled={deleting}>
                        Save
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    );
}