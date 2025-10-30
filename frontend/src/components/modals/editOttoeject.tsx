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
import ottoEjectIcon from '../../public/ottoEject-Icon.svg'
import thumbnail from '../../public/thumbnail.png';
import { OttoejectDevice } from "../../representations/ottoejectRepresentation.ts";
import { sendOttoejectMacro } from "../../ottoengine_API.ts";

export default function editOttoeject() {
    const { ottoeject, setOttoeject, setIsOttoejectEditModalOpen, ottoejectEditModalOpen, ottoejectIndex } = useContext(JobContext);
    const [refresh, setRefresh] = useState(false);
    const [tempOttoeject, setTempOttoeject] = useState<OttoejectDevice | undefined>();

    const editOttoejectSave = () => {
        if (tempOttoeject) {
            ottoeject[ottoejectIndex!] = tempOttoeject;
        }
        setOttoeject(ottoeject);
    }

    const deleteOttoeject = (id?: any) => {
        delete ottoeject[ottoejectIndex!];
    }

    const homeOttoeject = async (id?: any) => {
        console.log('Homing on OTTOeject ID: ', id);
        await sendOttoejectMacro(id, { macro: "OTTOEJECT_HOME" });
    }

    useEffect(() => {
        if (ottoejectIndex || ottoejectIndex == 0) {
            setTempOttoeject(ottoeject[ottoejectIndex]);
        }
    }, [ottoejectEditModalOpen]);

    return (
        <Modal
            isOpen={ottoejectEditModalOpen}
            className="pf-custom-new-ottoeject-modal"
            aria-label="newOttoeject"
            onClose={() => setIsOttoejectEditModalOpen(false)}
        >

            <PageSection className="pf-custom-new-ottoeject">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        <Brand src={ottoEjectIcon} alt="ottoEject logo" className='pf-custom-modal-icon' />
                        {'EDIT OTTOEJECT'}</Content>
                </ModalHeader>
                <div style={{ height: '3rem' }} />
                <Grid hasGutter>
                    <GridItem span={8} height={'max-content'}>
                        <Form isHorizontal className="pf-custom-text-align-left">
                            <Grid>
                                <GridItem span={3}>
                                    <Content>{'NAME:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInput
                                        id='ottoeject-name'
                                        value={tempOttoeject?.device_name}
                                        onChange={(_event, value: any) => setTempOttoeject({ ...tempOttoeject, device_name: value })}
                                        frameBorder={'none'}
                                    />
                                </GridItem>
                            </Grid>
                            <div className="pf-c-form-group">
                                <span className="pf-custom-border-label">{'CONNECTION: '}</span>
                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'IP ADDRESS:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        <TextInputGroup>
                                            <TextInputGroupMain id='ottoeject-connection-ipaddress' value={tempOttoeject?.ip_address} onChange={(_event, value: any) => setTempOttoeject({ ...tempOttoeject, ip_address: value })} />
                                        </TextInputGroup>
                                    </GridItem>
                                </Grid>
                            </div>
                        </Form>
                    </GridItem>

                    <GridItem span={4}>
                        <FormGroup>
                            <Brand src={thumbnail} alt={"ottoeject thumbnail"} className="pf-custom-thumbnail" />
                            {<Content className="pf-custom-align-center"><strong>{tempOttoeject?.status}</strong></Content>}
                        </FormGroup>
                    </GridItem>

                </Grid>

                <ModalFooter className="pf-custom-new-ottoeject-modal-footer">
                    <Button
                        variant="secondary"
                        onClick={() => { homeOttoeject(ottoeject[ottoejectIndex!].id) }}
                    >
                        {'Home OTTOeject'}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => { setIsOttoejectEditModalOpen(false) }}
                    >
                        {'Cancel'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        onClick={() => {
                            editOttoejectSave();
                            setIsOttoejectEditModalOpen(false)
                            setTempOttoeject({});
                        }}
                    >
                        {'Save'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        variant="danger"
                        onClick={() => {
                            deleteOttoeject(ottoeject[ottoejectIndex!]);
                            setIsOttoejectEditModalOpen(false)
                            setTempOttoeject({});
                        }}
                    >
                        {'Delete'}
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    )
}