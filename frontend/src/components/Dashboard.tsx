import React, { memo } from "react";
import { Grid, GridItem, PageSection } from "@patternfly/react-core";
// import uploadPrintFile from "./modals/UploadPrintFile";
import { Printers } from "./Printers";
import { Ottoeject } from "./OttoEject";
import { Ottorack } from "./OttoRack";
import { Job } from "./Jobs";

function Dashboard() {
    // COMMENT TEMPOARILY
    // APILoader();
  
    return (
      <>
        <Grid>
          <PageSection id="top-toolbar" className="pf-custom-top-toolbar">
            {/* {AddNewPrintJobButton()} */}
          </PageSection>
          <Grid hasGutter>
            <GridItem className="pf-c-overflow-auto" span={7} rowSpan={2}>
              <PageSection isWidthLimited className="pf-c-dashboard-jobs">
                <Job />
              </PageSection>
            </GridItem>
            <GridItem span={5}>
              <Grid hasGutter>
                <GridItem className="pf-c-overflow-auto" span={12}>
                  <Printers />
                </GridItem>
                <GridItem className="pf-c-overflow-auto" span={12}>
                  <Ottoeject />
                </GridItem>
                <GridItem className="pf-c-overflow-auto" span={12}>
                  <Ottorack />
                </GridItem>
              </Grid>
            </GridItem>
          </Grid>
        </Grid>
      </>
    );
  }
  
  export default memo(Dashboard);