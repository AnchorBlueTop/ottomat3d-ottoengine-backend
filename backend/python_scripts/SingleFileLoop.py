import requests
import time

LOOPS = 1

# Set the IP addresses of the 3D printer and the ottobot
PRINTER_ADDRESS = 'pi.local'
EJECTOBOT_ADDRESS = 'pi4.local'

# Define the API endpoints
PRINTER_STATUS_URL = f'http://{PRINTER_ADDRESS}/printer/objects/query?print_stats'
PRINTER_START_URL = f'http://{PRINTER_ADDRESS}/printer/print/start?filename=v1_sw_5mmcube_1.gcode'

EJECTOBOT_STATUS_URL = f'http://{EJECTOBOT_ADDRESS}/printer/info'
EJECTOBOT_EJECT_URL = f'http://{EJECTOBOT_ADDRESS}/printer/gcode/script?script=START_EJECT'

def test_connections():
    try:
        print("Testing connections to the 3D printer and the Ejectobot...")
        printer_response = requests.get(PRINTER_STATUS_URL)

        if printer_response and printer_response.status_code == 200:
            print("Printer: Successfully connected to the 3D printer.")
            # print(f"Printer: Status is: {printer_response.json().get('state')}")

        else:
            print(f"Printer: Failed to connect: {printer_response.status_code} - {printer_response.content}")
    except requests.exceptions.RequestException as e:
        print(f"Printer: Error connecting: {e}")

    try:
        ejectobot_response = requests.get(EJECTOBOT_STATUS_URL)
        if ejectobot_response.status_code == 200:
            print("Ejectobot: Successfully connected to the Ejectobot.")
            # print(f"Ejectobot: Status is: {ejectobot_response.json().get('state')}")

        else:
            print(f"Ejectobot: Failed to connect to the Ejectobot: {ejectobot_response.status_code} - {ejectobot_response.content}")
    except requests.exceptions.RequestException as e:
        print(f"Ejectobot: Error connecting to the Ejectobot: {e}")

def check_printer_status():
    response = requests.get(PRINTER_STATUS_URL)
    if response.status_code == 200:
        # print("Printer: Successfully fetched printer status.")
        # print(f"Printer: Resposne: {response.json()}")
        result = response.json().get('result', {})
        status = result.get('status', {}).get('print_stats', {}).get('state')
        print(f"Printer: status - {status}")
        
        return status
    else:
        print(f"Printer: Failed to get status: {response.status_code} - {response.content}")
        return None

def start_print_job():
    response = requests.post(PRINTER_START_URL)
    if response.status_code == 200:
        print("Printer: Print job started successfully.")
    else:
        print(f"Printer: Failed to start print job: {response.status_code} - {response.content}")

def start_ejection():
    print("Ejectobot: Starting ejection...")
    response = requests.post(EJECTOBOT_EJECT_URL)
    if response.status_code == 200:
        print("Ejectobot: Ejection completed.")
    else:
        print(f"Ejectobot: Failed to eject print job: {response.status_code} - {response.content}")


def main():


    LOOPS = input("How many times would you like to loop? ")
    try:
        LOOPS = int(LOOPS)
    except ValueError:
        print("Invalid input. Please enter an integer value for the number of loops.")
        return
    

    # Test the connections to the 3D printer and the ottobot
    test_connections()

    # Check if the printer is currently printing
    status = check_printer_status()

    if status != 'printing':
        print("Printer is not currently printing. Starting a new print job.")
        
        for i in range(LOOPS):
            print(f"Starting print job {i+1}")
            
            # Start a print job on the 3D printer
            start_print_job()
            
            # Wait for the print job to complete
            while True:
                status = check_printer_status()
                if status == 'complete':
                    print("Print job completed.")
                    break
                time.sleep(3)  # Check every 10 seconds
            
            # Start a job on the ottobot
            start_ejection()

            # Pause short period before the next print job starts
            time.sleep(2)
    else:
        print("Printer is currently printing. Please start job once printer is available.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user. Exiting...")