import {
    Button,
    Content,
    ContentVariants,
    Form,
    Grid,
    GridItem,
    Modal,
    ModalFooter,
    ModalHeader,
    NumberInput,
    PageSection,
    TextInput} from "@patternfly/react-core";
import { useContext, useState, useEffect } from "react";
import { JobContext } from "../../App.tsx";
import { OttoRackRegistration, Shelf } from "../../representations/ottorackRepresentation.ts";

export default function newOttorack() {
    const { ottorack, setOttorack, ottorackAddModalOpen, setIsOttorackAddModalOpen } = useContext(JobContext);
    const [tempOttorack, setTempOttorack] = useState<OttoRackRegistration>({shelves: []});
    const [rackVis, setRackVis] = useState<any[]>([]);

    const [tempShelf, setTempShelf] = useState<Shelf[]>([]);
    const minValue = 1;
    const maxValue = 6;
    var uniqueId: number | string = '';
    const [value, setValue] = useState<number>(minValue);
    
    const generateRackId = () => {
        const timestamp = new Date().getTime();
        uniqueId = (Math.random().toString(36).substring(2)) ;
        // setTempOttorack({...tempOttorack, id: uniqueId.toString()});
        return uniqueId;
    };

    const updateOttorackList = (tempOttorack: any) => {


        for (let index = 0; index < value; index++) {
            generateRackId();
            tempShelf.push({id: uniqueId.toString()})
            setTempShelf(tempShelf);
        }
        // setTempShelf(tempShelf);
        tempOttorack.shelves = tempShelf
        setTempOttorack({shelves: tempShelf});
        if (!ottorack) {
            // registerOttoeject(tempOttorack).then(() => { console.log('then in ottorack registration') });
            setOttorack([tempOttorack]);
            setTempOttorack({shelves: []});
            setTempShelf([]);
        } else {
            if (!ottorack[0]) {
                // console.log('in !ottorack[0]');
                delete ottorack[0];

                ottorack.push(tempOttorack);
                // registerOttoeject(tempOttorack).then(() => { console.log('then in ottorack registration') });
                setOttorack(ottorack);
                setTempOttorack({shelves: []});
                setTempShelf([]);
            } else {
                // registerOttoeject(tempOttorack).then(() => { console.log('then in ottorack registration') });
                ottorack.push(tempOttorack);
                setOttorack(ottorack);
                setIsOttorackAddModalOpen(false);
                setTempOttorack({shelves: []});
                setTempShelf([]);
            }
        }
        setIsOttorackAddModalOpen(false);
    };

    const normalizeBetween = (value: number, min: number, max: number) => {
        if (min !== undefined && max !== undefined) {
            return Math.max(Math.min(value, max), min);
        } else if (value <= min) {
            return min;
        } else if (value >= max) {
            return max;
        }
        return value;
    };

    const onMinus = () => {
        const newValue = normalizeBetween((value as number) - 1, minValue, maxValue);
        setValue(newValue);
        // tempShelf?.pop();
        // setTempOttorack({...tempOttorack, shelves: newValue});
        rackVisualisation(newValue);
    };

    const onChange = (event: React.FormEvent<HTMLInputElement>) => {
        const value = (event.target as HTMLInputElement).value;
        // setValue(value === '' ? value : +value);
        // setTempOttorack({...tempOttorack, shelves: (value === undefined ? value : +value)});
        rackVisualisation(value);
    };

    const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        const blurVal = +event.target.value;

        if (blurVal < minValue) {
            setValue(minValue);
            // setTempOttorack({...tempOttorack, shelves: minValue});
        } else if (blurVal > maxValue) {
            setValue(maxValue);
            // setTempOttorack({...tempOttorack, shelves: maxValue});
        }
        rackVisualisation(value);
    };

    const onPlus = () => {
        const newValue = normalizeBetween((value as number) + 1, minValue, maxValue);
        setValue(newValue);
        rackVisualisation(newValue);
    };

    const rackVisualisation = (value: any) => {
        const newRackVis = [];
        for (let i = 0; i < value; i++) {
            newRackVis.push(
                <>
                    <input className="customCheckBoxInput" type="checkbox"/>
                    <label className="customCheckBoxWrapper">
                        <div onClick={() => {console.log(`shelf - ${value-i}`)}} className="customCheckBox">
                        <div className="inner">{'>------------------< ' + (value-i)}</div>
                        </div>
                    </label>
                </>
            )
        }
        setRackVis(newRackVis.reverse());
    };

    useEffect(() => {
        generateRackId();
        setValue(minValue);
        rackVisualisation(value);
    }, [ottorackAddModalOpen]);

    return (
        <Modal
            isOpen={ottorackAddModalOpen}
            className="pf-custom-new-ottorack-modal"
            aria-label="newOttorack"
        >
            <PageSection className="pf-custom-new-ottorack">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        {/* <Brand src={ottoEjectIcon} alt="ottorack logo" className='pf-custom-modal-icon' /> */}
                        {' ADD NEW ottorack'}</Content>
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
                                        id='ottorack-name'
                                        placeholder=""
                                        value={tempOttorack?.name || ''}
                                        onChange={(_event, value: string) => setTempOttorack({ ...tempOttorack, name: value })}
                                    />
                                </GridItem>
                            </Grid>

                            <div className="pf-c-form-group">
                                <span className="pf-custom-border-label">{'SHELF CONFIGURATION: '}</span>
                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'SHELVES:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        {/* <TextInputGroup>
                                            <TextInputGroupMain id='ottorack-shelves' value={tempOttorack?.shelves} onChange={(_event, value: any) => setTempOttorack({ ...tempOttorack, shelves: value })} />
                                        </TextInputGroup> */}
                                        {<NumberInput
                                            value={value}
                                            min={minValue}
                                            max={maxValue}
                                            onMinus={onMinus}
                                            // onChange={onChange}
                                            // onBlur={onBlur}
                                            onPlus={onPlus}
                                            inputName="input"
                                            inputAriaLabel="number input"
                                            minusBtnAriaLabel="minus"
                                            plusBtnAriaLabel="plus"
                                        />}

                                    </GridItem>
                                </Grid>
                            </div>
                        </Form>
                    </GridItem>

                    {/* <GridItem span={4}>
                        <FormGroup>
                            <Content component={ContentVariants.h6}>{'THUMBNAIL'}</Content>
                            <Brand src={thumbnail} alt={"ottorack thumbnail"} className="pf-custom-thumbnail" />
                        </FormGroup>
                    </GridItem> */}

                    <GridItem span={4} className="pf-custom-rack-render">
                        {rackVis}
                    </GridItem>
                </Grid>

                <ModalFooter className="pf-custom-new-ottorack-modal-footer">
                    <Button
                        variant="danger"
                        onClick={() => { setIsOttorackAddModalOpen(false) }}
                    >
                        {'Cancel'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        onClick={() => {
                            console.log(tempOttorack);
                            updateOttorackList(tempOttorack);
                        }}
                    >
                        {'ADD'}
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    );
}