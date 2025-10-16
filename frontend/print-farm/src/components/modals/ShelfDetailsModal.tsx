import React from "react";
import {
    Modal,
    ModalHeader,
    ModalFooter,
    PageSection,
    Button,
    Content,
    ContentVariants,
    Grid,
    GridItem,
} from "@patternfly/react-core";
import { PrintJob } from "../../representations/ottorackRepresentation";

interface ShelfDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    shelfNumber: number | null;
    printJobDetails: PrintJob | null;
}

const ShelfDetailsModal: React.FC<ShelfDetailsModalProps> = ({
    isOpen,
    onClose,
    shelfNumber,
    printJobDetails,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            className="pf-custom-shelf-modal"
            aria-label="shelf-modal"
            onClose={onClose}
        >
            <PageSection>
                <ModalHeader>
                    <Content component={ContentVariants.h3}>
                        {`Shelf ${shelfNumber} Details`}
                    </Content>
                </ModalHeader>
                <Grid>
                    {printJobDetails ? (
                        <>
                            <GridItem span={12}>
                                <Content>{`Print Job ID: ${printJobDetails.id}`}</Content>
                            </GridItem>
                            <GridItem span={12}>
                                <Content>{`File Name: ${printJobDetails.fileName}`}</Content>
                            </GridItem>
                            <GridItem span={12}>
                                <Content>{`Status: ${printJobDetails.status}`}</Content>
                            </GridItem>
                        </>
                    ) : (
                        <GridItem span={12}>
                            <Content>No print job assigned to this shelf.</Content>
                        </GridItem>
                    )}
                </Grid>
                <ModalFooter>
                    <Button variant="primary" onClick={onClose}>
                        Close
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    );
};

export default ShelfDetailsModal;