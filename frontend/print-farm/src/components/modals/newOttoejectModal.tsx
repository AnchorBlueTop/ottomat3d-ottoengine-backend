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
import ottoEjectIcon from '../../public/ottoEject-Icon.svg';
import thumbnail from '../../public/thumbnail.png';
import { registerOttoeject } from "../../ottoengine_API.ts";
import { OttoejectDevice } from "../../representations/ottoejectRepresentation.ts";

export default function newOttoeject() {
    const { ottoeject, setOttoeject, ottoejectAddModalOpen, setIsOttoejectAddModalOpen } = useContext(JobContext);
    const [tempOttoeject, setTempOttoeject] = useState<OttoejectDevice>({});

    const updateOttoejectList = (tempOttoeject: any) => {
        if (!ottoeject) {
            registerOttoeject(tempOttoeject).then(() => { console.log('then in ottoeject registration') });
            setOttoeject([tempOttoeject]);
            setTempOttoeject({});
        } else {
            if (!ottoeject[0]) {
                delete ottoeject[0];
                ottoeject.push(tempOttoeject);
                registerOttoeject(tempOttoeject).then(() => { console.log('then in ottoeject registration') });

                setOttoeject(ottoeject);
                setTempOttoeject({});
            } else {
                registerOttoeject(tempOttoeject).then(() => { console.log('then in ottoeject registration') });
                ottoeject.push(tempOttoeject);
                setOttoeject(ottoeject);
                setIsOttoejectAddModalOpen(false);
                setTempOttoeject({});
            }
        }
        setIsOttoejectAddModalOpen(false);
    };

    return (
        <Modal
            isOpen={ottoejectAddModalOpen}
            className="pf-custom-new-ottoeject-modal"
            aria-label="newOttoeject"
            onClose={() => setIsOttoejectAddModalOpen(false)}
        >
            <PageSection className="pf-custom-new-ottoeject">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        <Brand src={ottoEjectIcon} alt="OttoEject logo" className='pf-custom-modal-icon' />
                        {' ADD NEW ottoeject'}</Content>
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
                                        id='ottoeject-name'
                                        placeholder=""
                                        value={tempOttoeject?.device_name}
                                        onChange={(_event, value: string) => setTempOttoeject({ ...tempOttoeject, device_name: value })}
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
                        </FormGroup>
                    </GridItem>
                </Grid>

                <ModalFooter className="pf-custom-new-ottoeject-modal-footer">
                    <Button
                        variant="danger"
                        onClick={() => { setIsOttoejectAddModalOpen(false) }}
                    >
                        {'Cancel'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        onClick={() => {
                            updateOttoejectList(tempOttoeject);
                        }}
                    >
                        {'ADD'}
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    )
}