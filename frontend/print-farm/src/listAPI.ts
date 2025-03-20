import printerRepresentation from "./printerRepresentation";
import readFile from "./readFileRepresentation";

const initHeader = () => {
    var myHeader = new Headers();
    myHeader.append(
        'Content-Type','any'
    );
    myHeader.append('Accept', '*/*');
    return myHeader; 
};

const fetchResponse = async (baseUrl:string, requestOptions: any) => {
    return fetch(
        baseUrl, 
        requestOptions
    ).then((response) => {
        return response.json();
    })
    .catch((error) => {
        return error.json();
    });
};

export class moonraker {
    // PRINTER API
    fetchPrinterInfo = async (
        printerURL: String
    ): Promise<printerRepresentation> => {
        var requestOptions = {
            method: 'GET',
            headers: initHeader()
        };
        return fetchResponse(
            printerURL + '/printer/info',
            requestOptions
        )
    };

    startPrint = async (
        printerURL: String, 
        fileName: String
    ): Promise<any> => {
        var requestOptions = {
            method: 'POST',
            headers: initHeader()
        };
        return fetchResponse(
            printerURL + '/printer/print/start?filename=' + fileName,
            requestOptions
        )
    };

    // TO-DO: REQUIRES IMPROVING
    // uploadFile = async (
    //     printerURL: String, 
    //     file: File
    // ): Promise<readFile> => {
    //     var requestOptions = {
    //         method: 'POST',
    //         // Content-Disposition: 'form-data',
    //         name: file.path ,
    //         'Accept': '*/*',
    //         'filename': file.fileName,
    //         'Content-Type': 'multipart/form-data',
    //     };
    //     return fetchResponse(
    //         printerURL + '/server/files/upload',
    //         requestOptions
    //     )
    // };

//     POST /server/files/upload
// Content-Type: multipart/form-data

// ------FormBoundaryemap3PkuvKX0B3HH
// Content-Disposition: form-data; name="file"; filename="myfile.gcode"
// Content-Type: application/octet-stream

// <binary data>
// ------FormBoundaryemap3PkuvKX0B3HH--


    // EJECTOBOT APIS
    ejectobotEject = async (
        ejectobotURL: String
    ): Promise<any> => {
        console.log(ejectobotURL);
        var myHeader = new Headers();
        myHeader.append(
            'Content-Type','application/json'
        );
        myHeader.append('Accept', '*/*');

        var requestOptions = {
            method: 'POST',
            headers: myHeader
        };
        return fetchResponse(
            ejectobotURL + '/printer/gcode/script?script=START_EJECT',
            requestOptions
        )
    };

    

};